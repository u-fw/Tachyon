import { Hono } from 'hono'
import { createReadStream, statSync } from 'fs'
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

const COMICS_DIR = process.env.COMICS_DIR || '/opt/comics'

/**
 * GET /comics - List all comics
 * Cache-friendly: returns stable JSON with comic IDs
 */
comics.get('/comics', (c) => {
    const comicsList = scanComics(COMICS_DIR)
    return c.json({
        count: comicsList.length,
        comics: comicsList,
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
            'Cache-Control': 'public, max-age=2592000, immutable',
            'ETag': etag,
        },
    })
}

export { comics as comicsRouter }
