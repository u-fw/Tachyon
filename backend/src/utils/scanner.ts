import { readdirSync, statSync } from 'fs'
import { join, extname, basename, relative } from 'path'
import * as chokidar from 'chokidar'
import { generateSignedCoverUrl } from './auth.js'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp']

export interface ComicInfo {
    id: string        // Base64 encoded path
    name: string      // Folder name
    path: string      // Original path
    pageCount: number // Number of images
    cover?: string    // Signed URL for cover
}

export interface PageInfo {
    index: number
    filename: string
    relativePath: string  // Relative path from comic folder
}

// Global Cache
let COMICS_MAP = new Map<string, ComicInfo>()
let COMICS_CACHE: ComicInfo[] = []
let WATCHER: chokidar.FSWatcher | null = null

/**
 * Natural sort comparator for filenames
 */
function naturalSort(a: string, b: string): number {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * Encode path to URL-safe Base64 ID
 */
export function encodeId(path: string): string {
    return Buffer.from(path, 'utf-8').toString('base64url')
}

/**
 * Decode Base64 ID back to path
 */
export function decodeId(id: string): string {
    return Buffer.from(id, 'base64url').toString('utf-8')
}

/**
 * Check if file is an image
 */
function isImage(filename: string): boolean {
    const ext = extname(filename).toLowerCase()
    return IMAGE_EXTENSIONS.includes(ext)
}

/**
 * Recursively scan a directory for images
 */
function scanImagesRecursive(basePath: string, currentPath: string = ''): { filename: string; relativePath: string }[] {
    const fullPath = currentPath ? join(basePath, currentPath) : basePath
    const results: { filename: string; relativePath: string }[] = []

    try {
        const entries = readdirSync(fullPath, { withFileTypes: true })

        for (const entry of entries) {
            const entryRelativePath = currentPath ? join(currentPath, entry.name) : entry.name

            if (entry.isDirectory()) {
                const subImages = scanImagesRecursive(basePath, entryRelativePath)
                results.push(...subImages)
            } else if (entry.isFile() && isImage(entry.name)) {
                results.push({
                    filename: entry.name,
                    relativePath: entryRelativePath,
                })
            }
        }
    } catch (error) {
        // console.error(`Debug: Scanning ${fullPath} - ${error}`)
    }

    return results
}

/**
 * Internal: Scan a single comic folder and return info
 */
function scanSingleComic(comicsDir: string, folderName: string): ComicInfo | null {
    try {
        const folderPath = join(comicsDir, folderName)
        const pages = getComicPages(folderPath)

        if (pages.length > 0) {
            const id = encodeId(folderName)
            return {
                id,
                name: folderName,
                path: folderName,
                pageCount: pages.length,
                cover: generateSignedCoverUrl(id) // Generate signed cover URL immediately
            }
        }
    } catch (e) {
        console.error(`Failed to scan comic ${folderName}:`, e)
    }
    return null
}

/**
 * Initialize the Scanner and Watcher
 * This should be called once at server startup
 */
export function initScanner(comicsDir: string) {
    console.log('[Scanner] Initializing In-Memory Cache...')
    const start = Date.now()

    // 1. Initial Full Scan
    try {
        const entries = readdirSync(comicsDir, { withFileTypes: true })
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const comic = scanSingleComic(comicsDir, entry.name)
                if (comic) {
                    COMICS_MAP.set(comic.id, comic)
                }
            }
        }
        updateCacheArray()
        console.log(`[Scanner] Initial scan complete. Found ${COMICS_CACHE.length} comics in ${Date.now() - start}ms.`)
    } catch (error) {
        console.error('[Scanner] Initial scan failed:', error)
    }

    // 2. Setup Watcher (Debounced)
    // Watch depth 0 (The comics themselves) and maybe depth 1? 
    // For performance, let's watch the root to detect new comic folders added/removed.
    // Watching deep structure might be too heavy if 100k files.
    // Compromise: Watch root dir.

    WATCHER = chokidar.watch(comicsDir, {
        ignoreInitial: true,
        depth: 0, // Only watch top level folders (Comics)
        awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 100
        }
    })

    WATCHER.on('addDir', (path) => {
        // A new folder was added at root
        const folderName = basename(path)
        if (folderName === basename(comicsDir)) return // Ignore root itself

        console.log(`[Scanner] New comic detected: ${folderName}`)
        const comic = scanSingleComic(comicsDir, folderName)
        if (comic) {
            COMICS_MAP.set(comic.id, comic)
            updateCacheArray()
        }
    })

    WATCHER.on('unlinkDir', (path) => {
        const folderName = basename(path)
        const id = encodeId(folderName)
        if (COMICS_MAP.has(id)) {
            console.log(`[Scanner] Comic removed: ${folderName}`)
            COMICS_MAP.delete(id)
            updateCacheArray()
        }
    })

    // NOTE: Modification of images INSIDE a comic is not watched by depth:0.
    // This is a trade-off for performance. Restart server to pick up new chapters in existing comic.
}

function updateCacheArray() {
    COMICS_CACHE = Array.from(COMICS_MAP.values()).sort((a, b) => naturalSort(a.name, b.name))
}

/**
 * Get paginated comics from Cache
 */
export function getComics(page: number = 1, limit: number = 36): { comics: ComicInfo[], total: number } {
    const start = (page - 1) * limit
    const end = start + limit

    // Regenerate signatures on read? 
    // Signatures expire in 1 year. We can regenerate them lazily or just use the ones in cache.
    // Since cache is in-memory and restarts reset it, 1 year is effectively "forever" for the process lifetime.

    return {
        comics: COMICS_CACHE.slice(start, end),
        total: COMICS_CACHE.length
    }
}

/**
 * Get single comic by ID from Cache
 */
export function getComic(id: string): ComicInfo | undefined {
    return COMICS_MAP.get(id)
}

/**
 * Get sorted list of image files in a comic folder (recursive)
 * This still reads disk on demand (when user opens a comic), which is fine.
 * The bottleneck was listing ALL comics.
 */
export function getComicPages(folderPath: string): PageInfo[] {
    try {
        const images = scanImagesRecursive(folderPath)
        images.sort((a, b) => naturalSort(a.relativePath, b.relativePath))

        return images.map((img, index) => ({
            index,
            filename: img.filename,
            relativePath: img.relativePath,
        }))
    } catch (error) {
        console.error('Error reading comic folder:', error)
        return []
    }
}

/**
 * Get file stats
 */
export function getFileStats(filePath: string): { size: number; mtime: number } | null {
    try {
        const stat = statSync(filePath)
        return { size: stat.size, mtime: stat.mtimeMs }
    } catch {
        return null
    }
}
