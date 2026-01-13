import { Hono } from 'hono'
import { createReadStream } from 'fs'
import { getCookie } from 'hono/cookie'
import {
    verifySessionToken,
    getOIDCConfig,
    generateSignedUrl,
    generateSignedCoverUrl,
    verifySignedUrl,
    verifySignedCoverUrl
} from '../utils/auth.js'
import { join, resolve, extname } from 'path'
import { Readable } from 'stream'
import mime from 'mime-types'
import {
    getComics,
    getComic,
    getComicPages,
    decodeId,
    getFileStats,
    type ComicInfo
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

    // 1. Check for valid Session Cookie first
    const sessionToken = getCookie(c, 'tachyon_session')
    if (sessionToken) {
        const session = verifySessionToken(sessionToken)
        if (session) {
            // Valid session, allow access
            return next()
        }
    }

    // 2. If no session, check for Valid Signature (for images/covers)
    const url = new URL(c.req.url)
    const expires = url.searchParams.get('expires')
    const sig = url.searchParams.get('sig')

    // Only allow signature bypass for specific image endpoints, not the list API
    if (c.req.path.includes('/pages/') || c.req.path.includes('/cover')) {
        if (expires && sig) {
            // Validate Signature in the specific route handler?
            // Actually, best to validate here or let the handler do it.
            // Let's attach a flag so handler knows it's via Signature?
            // Or just proceed and let handler verify.
            // PROBLEM: If we proceed here without throwing 401, we might allow access to other things?
            // "comics.use('*')" matches everything.
            // Let's return next() but ensure the handlers call verifySignedUrl if no session.

            // To be safe: Force verification NOW if it's an image request.
            // Parsing params from path is tricky here in middleware (regex?).
            // Simplified: Just pass through. The Handlers MUST check for Session OR Signature.
            return next()
        }
    }

    return c.json({ error: 'Unauthorized: Missing Session or Signature' }, 401)
})

const COMICS_DIR = process.env.COMICS_DIR || '/opt/comics'

/**
 * GET /comics - List all comics (Paginated from Memory Cache)
 */
comics.get('/comics', (c) => {
    const page = Math.max(1, parseInt(c.req.query('page') || '1'))
    const limit = Math.max(1, parseInt(c.req.query('limit') || '36')) // Default 36

    const { comics, total } = getComics(page, limit)

    // Log performance (debug)
    // console.log(`[API] Serving comics page ${page} (${comics.length} items)`)

    return c.json({
        count: total,
        comics: comics,
        page: page,
        totalPages: Math.ceil(total / limit)
    })
})

/**
 * GET /comics/:id - Get single comic info
 */
comics.get('/comics/:id', (c) => {
    const id = c.req.param('id')
    const comic = getComic(id)

    if (!comic) {
        return c.json({ error: 'Comic not found' }, 404)
    }

    return c.json(comic)
})

/**
 * GET /comics/:id/cover - Get comic cover (first image)
 * Requires: Session OR Valid Signature
 */
comics.get('/comics/:id/cover', async (c) => {
    const id = c.req.param('id')
    const sessionToken = getCookie(c, 'tachyon_session')
    const hasSession = sessionToken && verifySessionToken(sessionToken)

    // Check Signature if no session
    if (!hasSession) {
        const expires = c.req.query('expires')
        const sig = c.req.query('sig')
        if (!expires || !sig || !verifySignedCoverUrl(id, expires, sig)) {
            return c.json({ error: 'Unauthorized Identifier' }, 403)
        }
    }

    // Resolve File
    const comic = getComic(id)
    if (!comic) {
        // Fallback: decode ID directly if cache missed (e.g. restart) but ID is valid base64
        // But for security, consistent with cache is better. 
        // Let's try to find path from ID via cache.
        return c.json({ error: 'Comic not found' }, 404)
    }

    const folderName = comic.name // OR decodeId(id)
    const folderPath = resolve(join(COMICS_DIR, folderName))

    // Security check
    if (!folderPath.startsWith(resolve(COMICS_DIR))) return c.json({ error: 'Invalid path' }, 403)

    const pages = getComicPages(folderPath)
    if (pages.length === 0) return c.json({ error: 'No cover found' }, 404)

    const coverPath = join(folderPath, pages[0].relativePath)
    return streamImage(c, coverPath)
})

/**
 * GET /comics/:id/pages - List all pages (Returns Signed URLs)
 * Requires: Session
 */
comics.get('/comics/:id/pages', (c) => {
    // This endpoint returns instructions, requires Session.
    // Middleware already checked for Session or Sig. 
    // But since this isn't an image, we enforce Session strictly?
    // Actually, middleware allows pass if query params exist. 
    // But this endpoint typically is called by Frontend with Cookie.

    // Strict check: List of pages is privileged info.
    const sessionToken = getCookie(c, 'tachyon_session')
    if (!sessionToken || !verifySessionToken(sessionToken)) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    const id = c.req.param('id')
    const comic = getComic(id)
    if (!comic) return c.json({ error: 'Comic not found' }, 404)

    const folderName = comic.name
    const folderPath = resolve(join(COMICS_DIR, folderName))

    // Get actual pages logic
    const pages = getComicPages(folderPath)

    // Generate Signed URLs for each page
    // Default expiration: 365 days (from auth.ts default)
    const signedPages = pages.map(p => ({
        index: p.index,
        url: generateSignedUrl(id, p.index) // Auto-signed
    }))

    return c.json({
        id,
        name: comic.name,
        pageCount: pages.length,
        pages: signedPages
    })
})

/**
 * GET /comics/:id/pages/:page - Get single page image
 * Requires: Session OR Valid Signature
 */
comics.get('/comics/:id/pages/:page', async (c) => {
    const id = c.req.param('id')
    const pageIndex = parseInt(c.req.param('page'), 10)

    if (isNaN(pageIndex) || pageIndex < 0) return c.json({ error: 'Invalid page index' }, 400)

    // Auth Check
    const sessionToken = getCookie(c, 'tachyon_session')
    const hasSession = sessionToken && verifySessionToken(sessionToken)

    if (!hasSession) {
        const expires = c.req.query('expires')
        const sig = c.req.query('sig')
        if (!expires || !sig || !verifySignedUrl(id, pageIndex, expires, sig)) {
            return c.json({ error: 'Unauthorized Identifier' }, 403)
        }
    }

    // Resolve ID
    // We can decode ID directly to avoid Cache lookup if we want to support "Permalink even if Cache is rebuilding"
    // decodeId is safe.
    const folderName = decodeId(id)
    const folderPath = resolve(join(COMICS_DIR, folderName))

    if (!folderPath.startsWith(resolve(COMICS_DIR))) return c.json({ error: 'Invalid path' }, 403)

    const pages = getComicPages(folderPath)
    if (pageIndex >= pages.length) return c.json({ error: 'Page not found' }, 404)

    const imagePath = join(folderPath, pages[pageIndex].relativePath)
    return streamImage(c, imagePath)
})

/**
 * Stream image
 */
async function streamImage(c: any, imagePath: string): Promise<Response> {
    const stats = getFileStats(imagePath)
    if (!stats) return c.json({ error: 'File not found' }, 404)

    const ext = extname(imagePath).toLowerCase()
    const mimeType = mime.lookup(ext) || 'application/octet-stream'
    const etag = `"${Buffer.from(`${imagePath}-${stats.size}-${stats.mtime}`).toString('base64url').slice(0, 27)}"`

    const ifNoneMatch = c.req.header('If-None-Match')
    if (ifNoneMatch === etag) return new Response(null, { status: 304 })

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
