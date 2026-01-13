import { Hono } from 'hono'
import { createReadStream, statSync } from 'fs'
import { getCookie } from 'hono/cookie' // Added
import { verifySessionToken, getOIDCConfig } from '../utils/auth.js' // Added
import { join, resolve, extname } from 'path'
import { Readable } from 'stream'
import mime from 'mime-types'
import {
    scanComics,
    getComicPages,
    decodeId,
    getFileStats
} from '../utils/scanner.js'

const comics = new Hono()

// Auth Middleware: Protect all comic routes
comics.use('*', async (c, next) => {
    // Check config
    const config = getOIDCConfig()
    const isAuthEnabled = !!config.clientId

    if (!isAuthEnabled) {
        console.error('[Security] CRITICAL: OIDC_CLIENT_ID is missing. Refusing to start in insecure mode.')
        return c.json({ error: 'Server Configuration Error: Auth Missing' }, 500)
    }

    const sessionToken = getCookie(c, 'tachyon_session')
    if (!sessionToken) {
        return c.json({ error: 'Unauthorized: Missing Session Cookie' }, 401)
    }

    const session = verifySessionToken(sessionToken)
    if (!session) {
        return c.json({ error: 'Unauthorized: Invalid or Expired Session' }, 401)
    }

    // Attach session to context if needed, or just proceed
    return next()
})

const COMICS_DIR = process.env.COMICS_DIR || '/opt/comics'

// Simple in-memory cache
let comicsCache: {
    data: any[]
    lastUpdated: number
} | null = null

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * GET /comics - List all comics
 * Cache-friendly: returns stable JSON with comic IDs
 * Supports ?refresh=true to force cache update
 */
comics.get('/comics', (c) => {
    const forceRefresh = c.req.query('refresh') === 'true'
    const now = Date.now()

    // Use cache if valid and not forcing refresh
    if (!forceRefresh && comicsCache && (now - comicsCache.lastUpdated < CACHE_DURATION)) {
        // Apply pagination on cached data
        const comicsList = comicsCache.data
        const page = Math.max(1, parseInt(c.req.query('page') || '1'))
        const limit = Math.max(1, parseInt(c.req.query('limit') || '2000'))

        const startIndex = (page - 1) * limit
        const endIndex = startIndex + limit
        const paginatedComics = comicsList.slice(startIndex, endIndex)

        // Add X-Cache header to indicate HIT
        c.header('X-Server-Cache', 'HIT')

        return c.json({
            count: comicsList.length,
            comics: paginatedComics,
            page,
            totalPages: Math.ceil(comicsList.length / limit)
        })
    }

    // Cache MISS or refresh requested
    console.log('[Comics] Scanning directory...')
    const comicsList = scanComics(COMICS_DIR)

    // Update cache
    comicsCache = {
        data: comicsList,
        lastUpdated: now
    }

    // Pagination
    const page = Math.max(1, parseInt(c.req.query('page') || '1'))
    const limit = Math.max(1, parseInt(c.req.query('limit') || '2000'))

    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedComics = comicsList.slice(startIndex, endIndex)

    // Add X-Cache header to indicate MISS
    c.header('X-Server-Cache', 'MISS')

    return c.json({
        count: comicsList.length,
        comics: paginatedComics,
        page,
        totalPages: Math.ceil(comicsList.length / limit)
    })
})

/**
 * GET /comics/:id - Get single comic info
 */
comics.get('/comics/:id', (c) => {
    const id = c.req.param('id')
    const folderName = decodeId(id)
    const folderPath = resolve(join(COMICS_DIR, folderName))

    // Security: prevent path traversal
    if (!folderPath.startsWith(resolve(COMICS_DIR))) {
        return c.json({ error: 'Invalid path' }, 403)
    }

    const pages = getComicPages(folderPath)
    if (pages.length === 0) {
        return c.json({ error: 'Comic not found' }, 404)
    }

    return c.json({
        id,
        name: folderName,
        pageCount: pages.length,
    })
})

/**
 * GET /comics/:id/cover - Get comic cover (first image)
 * Cache-friendly: stable URL, long cache time
 */
comics.get('/comics/:id/cover', async (c) => {
    const id = c.req.param('id')
    const folderName = decodeId(id)
    const folderPath = resolve(join(COMICS_DIR, folderName))

    if (!folderPath.startsWith(resolve(COMICS_DIR))) {
        return c.json({ error: 'Invalid path' }, 403)
    }

    const pages = getComicPages(folderPath)
    if (pages.length === 0) {
        return c.json({ error: 'No cover found' }, 404)
    }

    // Use relativePath for nested folder support
    const coverPath = join(folderPath, pages[0].relativePath)
    return streamImage(c, coverPath)
})

/**
 * GET /comics/:id/pages - List all pages in a comic
 */
comics.get('/comics/:id/pages', (c) => {
    const id = c.req.param('id')
    const folderName = decodeId(id)
    const folderPath = resolve(join(COMICS_DIR, folderName))

    if (!folderPath.startsWith(resolve(COMICS_DIR))) {
        return c.json({ error: 'Invalid path' }, 403)
    }

    const pages = getComicPages(folderPath)
    return c.json({
        id,
        name: folderName,
        pageCount: pages.length,
        pages: pages.map(p => ({
            index: p.index,
            url: `/api/comics/${id}/pages/${p.index}`,
        })),
    })
})

/**
 * GET /comics/:id/pages/:page - Get single page image
 * Cache-friendly: stable URL with page index
 * Supports: ETag, Range requests
 */
comics.get('/comics/:id/pages/:page', async (c) => {
    const id = c.req.param('id')
    const pageIndex = parseInt(c.req.param('page'), 10)

    if (isNaN(pageIndex) || pageIndex < 0) {
        return c.json({ error: 'Invalid page index' }, 400)
    }

    const folderName = decodeId(id)
    const folderPath = resolve(join(COMICS_DIR, folderName))

    if (!folderPath.startsWith(resolve(COMICS_DIR))) {
        return c.json({ error: 'Invalid path' }, 403)
    }

    const pages = getComicPages(folderPath)
    if (pageIndex >= pages.length) {
        return c.json({ error: 'Page not found' }, 404)
    }

    // Use relativePath for nested folder support
    const imagePath = join(folderPath, pages[pageIndex].relativePath)
    return streamImage(c, imagePath)
})

/**
 * Stream image with proper headers for caching
 */
async function streamImage(c: any, imagePath: string): Promise<Response> {
    const stats = getFileStats(imagePath)
    if (!stats) {
        return c.json({ error: 'File not found' }, 404)
    }

    const ext = extname(imagePath).toLowerCase()
    const mimeType = mime.lookup(ext) || 'application/octet-stream'

    // Generate ETag based on path, size, and mtime
    const etag = `"${Buffer.from(`${imagePath}-${stats.size}-${stats.mtime}`).toString('base64url').slice(0, 27)}"`

    // Check If-None-Match for 304 response
    const ifNoneMatch = c.req.header('If-None-Match')
    if (ifNoneMatch === etag) {
        return new Response(null, { status: 304 })
    }

    // Stream the file
    const stream = createReadStream(imagePath)
    const webStream = Readable.toWeb(stream) as ReadableStream

    return new Response(webStream, {
        headers: {
            'Content-Type': mimeType,
            'Content-Length': stats.size.toString(),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'ETag': etag,
        },
    })
}

export { comics as comicsRouter }
