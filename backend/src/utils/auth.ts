import { createHmac, randomBytes, createHash } from 'crypto'

/**
 * Auth Configuration - Configure these via environment variables
 */
export interface OIDCConfig {
    issuer: string           // OIDC Provider URL
    clientId: string         // Client ID
    clientSecret: string     // Client Secret
    redirectUri: string      // Callback URL
    scope: string            // Scopes to request
    authUrl?: string         // Explicit Auth URL
    tokenUrl?: string        // Explicit Token URL
    userInfoUrl?: string     // Explicit UserInfo URL
}

export function getOIDCConfig(): OIDCConfig {
    return {
        issuer: process.env.OIDC_ISSUER || 'https://auth.example.com',
        clientId: process.env.OIDC_CLIENT_ID || '',
        clientSecret: process.env.OIDC_CLIENT_SECRET || '',
        redirectUri: process.env.OIDC_REDIRECT_URI || 'http://localhost:5173/callback',
        scope: process.env.OIDC_SCOPE || 'openid profile email',
        authUrl: process.env.OIDC_AUTH_URL,
        tokenUrl: process.env.OIDC_TOKEN_URL,
        userInfoUrl: process.env.OIDC_USERINFO_URL,
    }
}

/**
 * Secret key for signing URLs and sessions
 */
const SECRET_KEY = process.env.SECRET_KEY || randomBytes(32).toString('hex')

/**
 * Generate HMAC signature for URL signing
 */
export function generateSignature(data: string): string {
    return createHmac('sha256', SECRET_KEY)
        .update(data)
        .digest('base64url')
}

/**
 * Verify HMAC signature
 */
export function verifySignature(data: string, signature: string): boolean {
    const expected = generateSignature(data)
    return expected === signature
}

/**
 * Generate a signed URL for an image
 * URL format: /api/comics/:id/pages/:page?expires=TIMESTAMP&sig=SIGNATURE
 */
export function generateSignedUrl(comicId: string, page: number, expiresInSeconds: number = 31536000): string {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds
    const data = `${comicId}:${page}:${expires}`
    const sig = generateSignature(data)

    return `/api/comics/${comicId}/pages/${page}?expires=${expires}&sig=${sig}`
}

export function generateSignedCoverUrl(comicId: string, expiresInSeconds: number = 31536000): string {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds
    const data = `${comicId}:cover:${expires}`
    const sig = generateSignature(data)

    return `/api/comics/${comicId}/cover?expires=${expires}&sig=${sig}`
}

export function verifySignedCoverUrl(comicId: string, expires: string, sig: string): boolean {
    const expiresNum = parseInt(expires, 10)
    if (isNaN(expiresNum) || expiresNum < Math.floor(Date.now() / 1000)) return false
    const data = `${comicId}:cover:${expiresNum}`
    return verifySignature(data, sig)
}

/**
 * Verify a signed URL
 */
export function verifySignedUrl(comicId: string, page: number, expires: string, sig: string): boolean {
    const expiresNum = parseInt(expires, 10)

    // Check if expired
    if (isNaN(expiresNum) || expiresNum < Math.floor(Date.now() / 1000)) {
        return false
    }

    // Verify signature
    const data = `${comicId}:${page}:${expiresNum}`
    return verifySignature(data, sig)
}

/**
 * Session data structure
 */
export interface SessionData {
    userId: string
    email?: string
    name?: string
    avatar?: string
    expiresAt: number
}

/**
 * Generate a session token
 */
export function generateSessionToken(data: SessionData): string {
    const payload = JSON.stringify(data)
    const sig = generateSignature(payload)
    return Buffer.from(payload).toString('base64url') + '.' + sig
}

/**
 * Verify and decode a session token
 */
export function verifySessionToken(token: string): SessionData | null {
    try {
        const [payloadB64, sig] = token.split('.')
        if (!payloadB64 || !sig) return null

        const payload = Buffer.from(payloadB64, 'base64url').toString('utf-8')
        if (!verifySignature(payload, sig)) return null

        const data = JSON.parse(payload) as SessionData

        // Check if expired
        if (data.expiresAt < Math.floor(Date.now() / 1000)) {
            return null
        }

        return data
    } catch {
        return null
    }
}

/**
 * Generate a random state for OIDC
 */
export function generateState(): string {
    return randomBytes(16).toString('hex')
}

/**
 * Helper to Base64URL encode a buffer
 */
function base64URLEncode(buffer: Buffer): string {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
}

/**
 * Generate PKCE Code Verifier
 * Returns a random string between 43 and 128 characters
 */
export function generateCodeVerifier(): string {
    return base64URLEncode(randomBytes(32))
}

/**
 * Generate PKCE Code Challenge from Verifier
 */
export function generateCodeChallenge(verifier: string): string {
    return base64URLEncode(createHash('sha256').update(verifier).digest())
}
