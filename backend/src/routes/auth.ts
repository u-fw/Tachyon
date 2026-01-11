import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import {
    getOIDCConfig,
    generateSessionToken,
    verifySessionToken,
    generateState,
    generateCodeVerifier,
    generateCodeChallenge,
    type SessionData
} from '../utils/auth.js'

const auth = new Hono()

const SESSION_COOKIE = 'tachyon_session'
const STATE_COOKIE = 'tachyon_state'
const PKCE_COOKIE = 'tachyon_pkce'

// Cookie domain for cross-subdomain sharing (e.g., '.log.edu.kg')
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

/**
 * GET /auth/login - Redirect to OIDC provider
 */
auth.get('/login', async (c) => {
    const config = getOIDCConfig()

    if (!config.clientId) {
        return c.json({ error: 'OIDC not configured' }, 500)
    }

    const state = generateState()
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)

    // Store state in cookie for verification
    setCookie(c, STATE_COOKIE, state, {
        httpOnly: true,
        secure: IS_PRODUCTION,
        maxAge: 600, // 10 minutes
        sameSite: COOKIE_DOMAIN ? 'None' : 'Lax',
        domain: COOKIE_DOMAIN,
    })

    // Store PKCE verifier
    setCookie(c, PKCE_COOKIE, codeVerifier, {
        httpOnly: true,
        secure: IS_PRODUCTION,
        maxAge: 600, // 10 minutes
        sameSite: COOKIE_DOMAIN ? 'None' : 'Lax',
        domain: COOKIE_DOMAIN,
    })

    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: config.scope,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
    })

    const authUrl = config.authUrl || `${config.issuer}/authorize`
    return c.redirect(`${authUrl}?${params.toString()}`)
})

/**
 * GET /auth/callback - Handle OIDC callback
 */
auth.get('/callback', async (c) => {
    const config = getOIDCConfig()
    const code = c.req.query('code')
    const state = c.req.query('state')
    const storedState = getCookie(c, STATE_COOKIE)
    const codeVerifier = getCookie(c, PKCE_COOKIE)

    // Clear state cookies
    deleteCookie(c, STATE_COOKIE)
    deleteCookie(c, PKCE_COOKIE)

    // Verify state
    if (!state || state !== storedState) {
        return c.json({ error: 'Invalid state' }, 400)
    }

    if (!code) {
        return c.json({ error: 'No code provided' }, 400)
    }

    try {
        // Exchange code for tokens
        const tokenUrl = config.tokenUrl || `${config.issuer}/token`
        const tokenRes = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: config.redirectUri,
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code_verifier: codeVerifier || '',
            }),
        })

        if (!tokenRes.ok) {
            console.error('Token exchange failed:', await tokenRes.text())
            return c.json({ error: 'Token exchange failed' }, 500)
        }

        const tokens = await tokenRes.json() as { access_token: string; id_token?: string }

        // Get user info
        const userInfoUrl = config.userInfoUrl || `${config.issuer}/userinfo`
        const userRes = await fetch(userInfoUrl, {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
            },
        })

        if (!userRes.ok) {
            console.error('Userinfo fetch failed:', await userRes.text())
            return c.json({ error: 'Failed to get user info' }, 500)
        }

        const userInfo = await userRes.json() as {
            sub: string
            email?: string
            name?: string
            picture?: string
        }

        // Create session
        const sessionData: SessionData = {
            userId: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            avatar: userInfo.picture,
            expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
        }

        const sessionToken = generateSessionToken(sessionData)

        setCookie(c, SESSION_COOKIE, sessionToken, {
            httpOnly: true,
            secure: IS_PRODUCTION,
            maxAge: 7 * 24 * 60 * 60, // 7 days
            sameSite: COOKIE_DOMAIN ? 'None' : 'Lax',
            domain: COOKIE_DOMAIN,
        })

        // Redirect to home page
        const appUrl = process.env.APP_URL || '/'
        return c.redirect(appUrl)
    } catch (error) {
        console.error('Auth callback error:', error)
        return c.json({ error: 'Authentication failed' }, 500)
    }
})

/**
 * POST /auth/logout - Clear session
 */
auth.post('/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE)
    return c.json({ success: true })
})

/**
 * GET /auth/me - Get current user
 */
auth.get('/me', (c) => {
    const sessionToken = getCookie(c, SESSION_COOKIE)

    if (!sessionToken) {
        return c.json({ user: null })
    }

    const session = verifySessionToken(sessionToken)

    if (!session) {
        deleteCookie(c, SESSION_COOKIE)
        return c.json({ user: null })
    }

    return c.json({
        user: {
            id: session.userId,
            email: session.email,
            name: session.name,
            avatar: session.avatar,
        },
    })
})

export { auth as authRouter }
