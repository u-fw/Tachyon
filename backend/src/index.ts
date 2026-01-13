import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getCookie } from 'hono/cookie'
import { serve } from '@hono/node-server'
import { logger } from 'hono/logger'
import { comicsRouter } from './routes/comics.js'
import { authRouter } from './routes/auth.js'
import { verifySessionToken, getOIDCConfig } from './utils/auth.js'


const app = new Hono()

// CORS origins from env (comma-separated) + default dev origins
const corsOrigins = [
    'http://localhost:5173',
    'http://localhost:4173',
    ...(process.env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || []),
]

app.use('/*', cors({
    origin: corsOrigins,
    credentials: true,
}))

// Logger
app.use('*', logger())

// Check if OIDC is configured
const isAuthEnabled = () => {
    const config = getOIDCConfig()
    return !!config.clientId
}



// Cache headers middleware (CF Cache Rules handle edge caching)
app.use('/api/*', async (c, next) => {
    await next()
    const path = c.req.path

    // Long cache for images (1 year)
    if (path.includes('/cover') || path.match(/\/pages\/\d+/)) {
        if (!c.res.headers.has('Cache-Control')) {
            c.header('Cache-Control', 'public, max-age=31536000, immutable')
        }
    }
    // List & Info - NO CACHE for security (must re-validate auth)
    // Images are safe to cache because URLs are hard to guess
    else if (path === '/api/comics' || path.endsWith('/pages') || path.match(/\/api\/comics\/[^\/]+$/)) {
        c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
        c.header('Pragma', 'no-cache')
        c.header('Expires', '0')
    }
})

// Routes
app.route('/api/auth', authRouter)
app.route('/api', comicsRouter)

// Health check
app.get('/health', (c) => c.json({
    status: 'ok',
    timestamp: Date.now(),
    authEnabled: isAuthEnabled(),
}))

// Config endpoint (for frontend to check auth status)
app.get('/api/config', (c) => c.json({
    authEnabled: isAuthEnabled(),
}))

import { initScanner } from './utils/scanner.js'

const port = Number(process.env.PORT) || 3001
console.log(`🚀 Tachyon API running on http://localhost:${port}`)
console.log(`🔐 Auth: ${isAuthEnabled() ? 'Enabled' : 'Disabled (set OIDC_CLIENT_ID to enable)'}`)

// Initialize Comic Scanner (In-Memory Cache)
const COMICS_DIR = process.env.COMICS_DIR || '/opt/comics'
initScanner(COMICS_DIR)

serve({
    fetch: app.fetch,
    port,
})
