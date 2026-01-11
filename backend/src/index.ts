import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getCookie } from 'hono/cookie'
import { serve } from '@hono/node-server'
import { comicsRouter } from './routes/comics.js'
import { authRouter } from './routes/auth.js'
import { verifySessionToken, getOIDCConfig } from './utils/auth.js'


const app = new Hono()

// CORS for frontend development
app.use('/*', cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    credentials: true,
}))

// Check if OIDC is configured
const isAuthEnabled = () => {
    const config = getOIDCConfig()
    return !!config.clientId
}

// Auth middleware - only apply if OIDC is configured
app.use('/api/comics/*', async (c, next) => {
    if (!isAuthEnabled()) {
        // Auth disabled, allow all requests
        return next()
    }

    const sessionToken = getCookie(c, 'tachyon_session')

    if (!sessionToken) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    const session = verifySessionToken(sessionToken)


    if (!session) {
        return c.json({ error: 'Session expired' }, 401)
    }

    // Session is valid, continue to next handler
    return next()
})

// Cache headers middleware
app.use('/api/*', async (c, next) => {
    await next()
    const path = c.req.path

    // Long cache for images (30 days)
    if (path.includes('/cover') || path.match(/\/pages\/\d+/)) {
        if (!c.res.headers.has('Cache-Control')) {
            c.header('Cache-Control', 'public, max-age=2592000, immutable')
        }
    }
    // Short cache for listings (5 minutes)
    else if (path === '/api/comics' || path.endsWith('/pages')) {
        c.header('Cache-Control', 'public, max-age=300, s-maxage=600')
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

const port = Number(process.env.PORT) || 3001
console.log(`🚀 Tachyon API running on http://localhost:${port}`)
console.log(`🔐 Auth: ${isAuthEnabled() ? 'Enabled' : 'Disabled (set OIDC_CLIENT_ID to enable)'}`)

serve({
    fetch: app.fetch,
    port,
})
