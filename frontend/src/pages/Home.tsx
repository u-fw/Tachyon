import { useEffect, useState, useMemo, useRef } from 'react'
import { fetchComics, getCoverUrl, API_BASE, type ComicInfo } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'
import { useI18n } from '../contexts/I18nContext'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import ComicCard from '../components/ComicCard'
import SortDropdown from '../components/SortDropdown'
import SettingsModal from '../components/SettingsModal'

type SortOption = 'name' | 'pages' | 'pages-desc'

export default function Home() {
    const { theme, toggleTheme } = useTheme()
    const { language, setLanguage, t } = useI18n()
    const { user, authEnabled, isLoading: authLoading, login, logout } = useAuth()
    const { viewMode, setViewMode, itemsPerPage } = useSettings()

    // Data State
    const [comics, setComics] = useState<ComicInfo[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Pagination State
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)
    const [totalComics, setTotalComics] = useState(0)

    // UI State
    const [search, setSearch] = useState('')
    const [sort, setSort] = useState<SortOption>('name')
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [showBackToTop, setShowBackToTop] = useState(false)

    // Reset pagination when settings change
    useEffect(() => {
        if (authLoading) return
        if (authEnabled && !user) return

        setPage(1)
        setComics([])
        setLoading(true)
        loadComics(1, true)
    }, [itemsPerPage, authEnabled, user, authLoading])

    // Back to top visibility
    useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > 500)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    // Intersection Observer for Infinite Scroll
    const observerTarget = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && !search) {
                    handleLoadMore()
                }
            },
            { threshold: 0.1, rootMargin: '100px' }
        )

        if (observerTarget.current) {
            observer.observe(observerTarget.current)
        }

        return () => observer.disconnect()
    }, [hasMore, loading, loadingMore, search])

    const loadComics = async (pageNum: number, isReset = false) => {
        try {
            const data = await fetchComics(pageNum, itemsPerPage)

            setComics(prev => {
                if (isReset) return data.comics
                // Deduplicate just in case
                const newComics = data.comics.filter(c => !prev.some(p => p.id === c.id))
                return [...prev, ...newComics]
            })

            setHasMore(pageNum < data.totalPages)
            setTotalComics(data.count)
            setLoading(false)
            setLoadingMore(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load comics')
            setLoading(false)
            setLoadingMore(false)
        }
    }

    const handleLoadMore = () => {
        if (!loadingMore && hasMore) {
            setLoadingMore(true)
            const nextPage = page + 1
            setPage(nextPage)
            loadComics(nextPage)
        }
    }

    // Filtered and sorted comics
    const filteredComics = useMemo(() => {
        let result = [...comics]

        // Search filter
        if (search.trim()) {
            const query = search.toLowerCase()
            result = result.filter(c => c.name.toLowerCase().includes(query))
        }

        // Sort
        switch (sort) {
            case 'name':
                result.sort((a, b) => a.name.localeCompare(b.name, language === 'zh' ? 'zh-CN' : 'en'))
                break
            case 'pages':
                result.sort((a, b) => a.pageCount - b.pageCount)
                break
            case 'pages-desc':
                result.sort((a, b) => b.pageCount - a.pageCount)
                break
        }

        return result
    }, [comics, search, sort, language])


    // =========================================================================
    // UNAUTHENTICATED VIEW - Login Page (p1 Light / p4 Dark)
    // =========================================================================
    if (authEnabled && !user) {
        return (
            <div className={`min-h-screen flex flex-col font-['Inter'] ${theme === 'dark' ? 'bg-login-dark' : 'bg-login-light'}`}>
                {/* Top Navigation */}
                <nav className="absolute top-0 right-0 p-4 sm:p-6 flex items-center space-x-3 z-10">
                    {/* Settings */}
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="nav-btn min-w-[40px] h-[40px] flex items-center justify-center rounded-xl text-gray-700 dark:text-gray-300 px-3"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>

                    {/* Language */}
                    <button
                        onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
                        className="nav-btn h-[40px] min-w-[40px] px-3 flex items-center space-x-2 rounded-xl text-gray-700 dark:text-gray-300 font-medium text-sm"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="2" x2="22" y1="12" y2="12" />
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                        <span>{language === 'en' ? 'EN' : '中文'}</span>
                    </button>

                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="nav-btn min-w-[40px] h-[40px] flex items-center justify-center rounded-xl text-gray-700 dark:text-gray-300 px-3"
                    >
                        {theme === 'dark' ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                            </svg>
                        )}
                    </button>
                </nav>

                {/* Main Content - Glass Card */}
                <main className="flex-grow flex items-center justify-center p-4">
                    <div className="glass-card w-full max-w-[420px] rounded-[32px] p-12 flex flex-col items-center text-center animate-fade-in-up">
                        {/* Logo */}
                        <div className="mb-5 relative group">
                            {theme === 'dark' && (
                                <div className="absolute -inset-1 bg-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000" />
                            )}
                            <div className="relative w-24 h-24 rounded-3xl shadow-lg bg-gradient-to-br from-[#8B5CF6] to-[#a855f7] flex items-center justify-center">
                                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path clipRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" fillRule="evenodd" />
                                </svg>
                            </div>
                        </div>

                        {/* Title */}
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
                            {t('appName')}
                        </h1>

                        {/* Tagline */}
                        <p className="text-[#666666] dark:text-gray-300 text-lg mb-10 font-medium">
                            {t('appTagline')}
                        </p>

                        {/* Login Button */}
                        <button
                            onClick={login}
                            className="btn-login w-full text-white font-semibold h-[48px] px-6 rounded-full flex items-center justify-center space-x-3 mb-6 hover:scale-[1.02] transition-transform"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                            </svg>
                            <span className="text-[17px]">Login with OpenID</span>
                        </button>

                        {/* Footer */}
                        <p className="text-sm text-gray-500 dark:text-gray-500 mt-6">
                            Protected by <a className="underline decoration-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors" href="#">OpenID Connect</a>
                        </p>
                    </div>
                </main>

                <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            </div>
        )
    }

    // =========================================================================
    // AUTHENTICATED VIEW - Dashboard (p2 Light / p3 Dark)
    // =========================================================================
    return (
        <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
            {/* Header */}
            <header className="header sticky top-0 z-50 h-16 px-4 sm:px-6 flex items-center justify-between">
                {/* Logo Section */}
                <div className="flex items-center gap-2 w-1/4">
                    <a
                        href="https://github.com/5lin/Tachyon"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 group"
                    >
                        <div className="w-8 h-8 bg-[var(--color-accent)] rounded-md flex items-center justify-center text-white">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path clipRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" fillRule="evenodd" />
                            </svg>
                        </div>
                        <span className="text-xl font-bold tracking-tight text-[var(--color-text)]">{t('appName')}</span>
                    </a>
                </div>

                {/* Search Bar */}
                <div className="hidden md:block flex-1 max-w-[400px] relative">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('searchPlaceholder')}
                        className="search-input w-full"
                    />
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-subtle)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>

                {/* Right Controls */}
                <div className="flex items-center justify-end gap-4 w-1/4">
                    {/* Settings (Visible) */}
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] p-2 rounded transition-colors"
                        title={t('settings')}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>

                    {/* Language */}
                    <button
                        onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
                        className="flex items-center gap-1 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] px-2 py-1 rounded transition-colors"
                    >
                        {language === 'en' ? 'EN' : '中文'}
                        <svg className="w-4 h-4 text-[var(--color-text-subtle)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* Theme Toggle */}
                    <div className="flex items-center gap-1 bg-[var(--color-bg-input)] rounded-full p-1 border border-[var(--color-border)]">
                        <button
                            onClick={() => theme === 'dark' && toggleTheme()}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${theme === 'light' ? 'bg-gray-200 dark:bg-gray-600 shadow-sm text-gray-800' : 'text-[var(--color-text-subtle)] hover:text-[var(--color-text)]'}`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => theme === 'light' && toggleTheme()}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-gray-600 shadow-sm text-white' : 'text-[var(--color-text-subtle)] hover:text-[var(--color-text)]'}`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        </button>
                    </div>

                    {/* User Avatar */}
                    {user && (
                        <div className="relative group/menu">
                            <button className="avatar">
                                {user.avatar ? (
                                    <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    user.name?.[0]?.toUpperCase() || 'U'
                                )}
                            </button>

                            <div className="absolute right-0 top-full mt-2 w-48 py-1 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-200 z-50">
                                <div className="px-4 py-3 border-b border-[var(--color-border)]">
                                    <p className="text-sm font-medium text-[var(--color-text)] truncate">{user.name}</p>
                                    <p className="text-xs text-[var(--color-text-muted)] truncate">{user.email}</p>
                                </div>
                                <button
                                    onClick={() => setIsSettingsOpen(true)}
                                    className="w-full text-left px-4 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {t('settings')}
                                </button>
                                <button
                                    onClick={logout}
                                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-[var(--color-bg-hover)] transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    {t('logout')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-4 sm:p-6 md:px-10 md:py-8">
                {/* Controls Bar */}
                <section className="flex flex-col md:flex-row justify-end items-center mb-6 gap-4">
                    {/* Sort Dropdown */}
                    <SortDropdown value={sort} onChange={setSort} />

                    {/* View Toggle */}
                    <div className="view-toggle">
                        <button
                            onClick={() => setViewMode('grid')}
                            title={t('gridView')}
                            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            title={t('listView')}
                            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    </div>

                    {/* Counter */}
                    <span className="text-sm text-[var(--color-text-muted)] font-medium">
                        {t('comicsCount', { count: search ? filteredComics.length : totalComics })}
                    </span>
                </section>

                {/* Content */}
                {loading && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
                        {[...Array(itemsPerPage)].map((_, i) => (
                            <div key={i} className="comic-card">
                                <div className="aspect-[2/3] rounded-lg loading-shimmer mb-2.5" />
                                <div className="h-4 rounded loading-shimmer w-3/4" />
                            </div>
                        ))}
                    </div>
                )}

                {error && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-20 h-20 mb-6 rounded-3xl bg-red-500/10 flex items-center justify-center">
                            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">{t('loadFailed')}</h2>
                        <p className="text-[var(--color-text-muted)] mb-6">{error}</p>
                        <button onClick={() => window.location.reload()} className="btn-login px-6 py-2 rounded-lg text-white">
                            {t('reload')}
                        </button>
                    </div>
                )}

                {!loading && !error && comics.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-24 h-24 mb-6 rounded-3xl bg-[var(--color-accent)]/10 flex items-center justify-center">
                            <svg className="w-12 h-12 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">{t('noComics')}</h2>
                        <p className="text-[var(--color-text-muted)] text-center max-w-md">{t('noComicsHint')}</p>
                    </div>
                )}

                {!loading && !error && comics.length > 0 && filteredComics.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-20 h-20 mb-6 rounded-3xl bg-[var(--color-bg-card)] flex items-center justify-center">
                            <svg className="w-10 h-10 text-[var(--color-text-subtle)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">{t('noResults')}</h2>
                        <p className="text-[var(--color-text-muted)]">{t('noResultsHint')}</p>
                    </div>
                )}

                {/* Grid View */}
                {!loading && !error && filteredComics.length > 0 && viewMode === 'grid' && (
                    <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
                        {filteredComics.map((comic, index) => (
                            <div
                                key={comic.id}
                                className="fade-in"
                                style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                            >
                                <ComicCard
                                    id={comic.id}
                                    name={comic.name}
                                    coverUrl={comic.cover ? `${API_BASE}${comic.cover}` : getCoverUrl(comic.id)}
                                    pageCount={comic.pageCount}
                                    view="grid"
                                />
                            </div>
                        ))}
                    </section>
                )}

                {/* List View */}
                {!loading && !error && filteredComics.length > 0 && viewMode === 'list' && (
                    <section className="space-y-3">
                        {filteredComics.map((comic, index) => (
                            <div
                                key={comic.id}
                                className="fade-in"
                                style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
                            >
                                <ComicCard
                                    id={comic.id}
                                    name={comic.name}
                                    coverUrl={comic.cover ? `${API_BASE}${comic.cover}` : getCoverUrl(comic.id)}
                                    pageCount={comic.pageCount}
                                    view="list"
                                />
                            </div>
                        ))}
                    </section>
                )}

                {/* Infinite Scroll Sentinel */}
                {!loading && !error && hasMore && !search && (
                    <div ref={observerTarget} className="h-24 flex items-center justify-center p-4">
                        {loadingMore && (
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 ease-linear rounded-full border-2 border-t-2 border-[var(--color-text-muted)] border-t-[var(--color-accent)] animate-spin" />
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Back to Top Button */}
            {/* Back to Top Button */}
            <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className={`fixed bottom-8 right-8 p-3 rounded-full text-white shadow-2xl ring-2 ring-white dark:ring-white/20 transition-all duration-300 transform hover:scale-110 active:scale-95 z-40 btn-login ${showBackToTop ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
                    }`}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
            </button>

            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </div>
    )
}

