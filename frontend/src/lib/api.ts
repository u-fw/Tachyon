const API_BASE = import.meta.env.VITE_API_URL || ''

export interface ComicInfo {
    id: string
    name: string
    path: string
    pageCount: number
}

export interface ComicsResponse {
    count: number
    total: number
    comics: ComicInfo[]
    page: number
    totalPages: number
}

export interface PageInfo {
    index: number
    url: string
}

export interface PagesResponse {
    id: string
    name: string
    pageCount: number
    pages: PageInfo[]
}

/**
 * Fetch all comics with pagination
 */
export async function fetchComics(page = 1, limit = 24): Promise<ComicsResponse> {
    const res = await fetch(`${API_BASE}/api/comics?page=${page}&limit=${limit}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch comics')
    return res.json()
}

/**
 * Fetch pages of a comic
 */
export async function fetchPages(comicId: string): Promise<PagesResponse> {
    const res = await fetch(`${API_BASE}/api/comics/${comicId}/pages`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch pages')
    return res.json()
}

/**
 * Get cover image URL
 */
export function getCoverUrl(comicId: string): string {
    return `${API_BASE}/api/comics/${comicId}/cover`
}

/**
 * Get page image URL
 */
export function getPageUrl(comicId: string, pageIndex: number): string {
    return `${API_BASE}/api/comics/${comicId}/pages/${pageIndex}`
}
