import { useState, useEffect } from 'react'
import { useI18n } from '../contexts/I18nContext'
import { useTheme } from '../contexts/ThemeContext'
import { useSettings } from '../contexts/SettingsContext'

interface SettingsModalProps {
    isOpen: boolean
    onClose: () => void
    initialTab?: Tab
}

type Tab = 'general' | 'appearance' | 'reader' | 'about'

export default function SettingsModal({ isOpen, onClose, initialTab = 'general' }: SettingsModalProps) {
    const { t, language, setLanguage } = useI18n()
    const { theme, setTheme } = useTheme()
    const {
        viewMode, setViewMode,
        itemsPerPage, setItemsPerPage,
        preloadCount, setPreloadCount
    } = useSettings()

    const [activeTab, setActiveTab] = useState<Tab>(initialTab)
    const [localItemsPerPage, setLocalItemsPerPage] = useState(itemsPerPage.toString())

    useEffect(() => {
        setLocalItemsPerPage(itemsPerPage.toString())
    }, [itemsPerPage])

    // Debounce itemsPerPage update
    useEffect(() => {
        const timer = setTimeout(() => {
            const val = parseInt(localItemsPerPage)
            if (!isNaN(val) && val > 0 && val !== itemsPerPage) {
                setItemsPerPage(val)
            }
        }, 800)
        return () => clearTimeout(timer)
    }, [localItemsPerPage, itemsPerPage, setItemsPerPage])

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab)
        }
    }, [isOpen, initialTab])

    if (!isOpen) return null

    const tabs = [
        {
            id: 'general' as Tab,
            label: t('general'),
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
            )
        },
        {
            id: 'appearance' as Tab,
            label: t('appearance'),
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            )
        },
        {
            id: 'reader' as Tab,
            label: t('reader'),
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            )
        },
        {
            id: 'about' as Tab,
            label: t('about'),
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        }
    ]

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

            {/* Modal Container */}
            <div className="relative w-full max-w-3xl h-[600px] glass-card rounded-2xl overflow-hidden transform transition-all animate-scale-in flex">

                {/* Sidebar */}
                <div className="w-56 flex-shrink-0 bg-white/50 dark:bg-black/20 border-r border-[var(--color-border)] p-4 flex flex-col gap-2 backdrop-blur-md">
                    <div className="px-2 py-4 mb-2">
                        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-accent)] to-purple-500">
                            {t('settings')}
                        </h2>
                    </div>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                                ? 'bg-white dark:bg-white/10 text-[var(--color-text)] shadow-sm font-semibold'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-white/30 dark:hover:bg-white/5'
                                }`}
                        >
                            <span className={`transition-colors ${activeTab === tab.id ? 'text-[var(--color-accent)]' : ''}`}>
                                {tab.icon}
                            </span>
                            {tab.label}
                        </button>
                    ))}

                    <div className="mt-auto px-2 py-4">
                        <p className="text-xs text-[var(--color-text-muted)] opacity-50 text-center">Tachyon v1.0.0</p>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-white/30 dark:bg-black/10 backdrop-blur-sm">
                    {/* Header */}
                    <div className="flex-shrink-0 px-8 py-5 flex items-center justify-between border-b border-[var(--color-border)] bg-white/40 dark:bg-black/20 backdrop-blur-md sticky top-0 z-10">
                        <h3 className="text-lg font-semibold">{tabs.find(t => t.id === activeTab)?.label}</h3>
                        <button
                            onClick={onClose}
                            className="p-2 -mr-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-8">
                        {activeTab === 'general' && (
                            <div className="space-y-8 animate-fade-in">
                                {/* Language */}
                                <section className="space-y-4">
                                    <h4 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider">{t('language')}</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setLanguage('en')}
                                            className={`p-4 rounded-xl border transition-all text-left ${language === 'en'
                                                ? 'bg-white dark:bg-white/10 border-[var(--color-accent)] ring-2 ring-[var(--color-accent)] shadow-md'
                                                : 'bg-white/50 dark:bg-white/5 border-transparent hover:bg-white dark:hover:bg-white/10'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-800">EN</div>
                                                <span className="font-medium">English</span>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => setLanguage('zh')}
                                            className={`p-4 rounded-xl border transition-all text-left ${language === 'zh'
                                                ? 'bg-white dark:bg-white/10 border-[var(--color-accent)] ring-2 ring-[var(--color-accent)] shadow-md'
                                                : 'bg-white/50 dark:bg-white/5 border-transparent hover:bg-white dark:hover:bg-white/10'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-xs font-bold text-red-800">ZH</div>
                                                <span className="font-medium">中文</span>
                                            </div>
                                        </button>
                                    </div>
                                </section>

                                {/* Pagination */}
                                <section className="space-y-4">
                                    <h4 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Pagination</h4>
                                    <div className="flex items-center gap-4">
                                        <div className="relative flex-1">
                                            <input
                                                type="number"
                                                min="1"
                                                max="100"
                                                value={localItemsPerPage}
                                                onChange={(e) => setLocalItemsPerPage(e.target.value)}
                                                className="w-full bg-white/50 dark:bg-black/20 border border-[var(--color-border)] rounded-xl px-4 py-3 outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all font-medium text-lg"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-sm pointer-events-none">
                                                batch size
                                            </div>
                                        </div>
                                        <div className="text-xs text-[var(--color-text-muted)]">
                                            Default: 36
                                        </div>
                                    </div>
                                    <p className="text-sm text-[var(--color-text-muted)]">Items loaded per batch (Infinite Scroll)</p>
                                </section>
                            </div>
                        )}

                        {activeTab === 'appearance' && (
                            <div className="space-y-8 animate-fade-in">
                                {/* Theme */}
                                <section className="space-y-4">
                                    <h4 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider">{t('appearance')}</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setTheme('light')}
                                            className={`p-4 rounded-xl border transition-all text-left group ${theme === 'light'
                                                ? 'bg-white dark:bg-white/10 border-[var(--color-accent)] ring-2 ring-[var(--color-accent)] shadow-md'
                                                : 'bg-white/50 dark:bg-white/5 border-transparent hover:bg-white dark:hover:bg-white/10'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'}`}>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                                    </svg>
                                                </div>
                                                {theme === 'light' && <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_10px_rgba(139,92,246,0.5)]" />}
                                            </div>
                                            <span className="font-medium">{t('light')}</span>
                                        </button>

                                        <button
                                            onClick={() => setTheme('dark')}
                                            className={`p-4 rounded-xl border transition-all text-left group ${theme === 'dark'
                                                ? 'bg-white dark:bg-white/10 border-[var(--color-accent)] ring-2 ring-[var(--color-accent)] shadow-md'
                                                : 'bg-white/50 dark:bg-white/5 border-transparent hover:bg-white dark:hover:bg-white/10'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'}`}>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                                    </svg>
                                                </div>
                                                {theme === 'dark' && <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_10px_rgba(139,92,246,0.5)]" />}
                                            </div>
                                            <span className="font-medium">{t('dark')}</span>
                                        </button>
                                    </div>
                                </section>

                                {/* View Mode */}
                                <section className="space-y-4">
                                    <h4 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider">{t('gridView')} / {t('listView')}</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setViewMode('grid')}
                                            className={`p-4 rounded-xl border transition-all text-left ${viewMode === 'grid'
                                                ? 'bg-white dark:bg-white/10 border-[var(--color-accent)] ring-2 ring-[var(--color-accent)] shadow-md'
                                                : 'bg-white/50 dark:bg-white/5 border-transparent hover:bg-white dark:hover:bg-white/10'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'}`}>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <span className="font-medium">{t('gridView')}</span>
                                        </button>

                                        <button
                                            onClick={() => setViewMode('list')}
                                            className={`p-4 rounded-xl border transition-all text-left ${viewMode === 'list'
                                                ? 'bg-white dark:bg-white/10 border-[var(--color-accent)] ring-2 ring-[var(--color-accent)] shadow-md'
                                                : 'bg-white/50 dark:bg-white/5 border-transparent hover:bg-white dark:hover:bg-white/10'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'}`}>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <span className="font-medium">{t('listView')}</span>
                                        </button>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'reader' && (
                            <div className="space-y-8 animate-fade-in">
                                <section className="space-y-4">
                                    <h4 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider">{t('preloadPages')}</h4>
                                    <div className="bg-white/50 dark:bg-white/5 border border-[var(--color-border)] rounded-xl p-1 flex">
                                        {[3, 5, 10, 999].map(count => (
                                            <button
                                                key={count}
                                                onClick={() => setPreloadCount(count)}
                                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${preloadCount === count
                                                    ? 'bg-white dark:bg-white/10 text-[var(--color-text)] shadow-sm ring-1 ring-black/5 dark:ring-white/10 font-semibold'
                                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                                                    }`}
                                            >
                                                {count === 999 ? 'All' : count}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-sm text-[var(--color-text-muted)] flex items-start gap-2">
                                        <svg className="w-5 h-5 flex-shrink-0 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {t('preloadHint')}
                                    </p>
                                </section>
                            </div>
                        )}

                        {activeTab === 'about' && (
                            <div className="text-center py-12 animate-fade-in">
                                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[var(--color-accent)] to-purple-600 rounded-3xl flex items-center justify-center text-white text-3xl font-bold mb-6 shadow-xl shadow-[var(--color-accent)]/30">
                                    T
                                </div>
                                <h2 className="text-2xl font-bold mb-2">Tachyon</h2>
                                <p className="text-[var(--color-text-muted)] mb-8">Lightning-fast Comic Reader</p>

                                <div className="max-w-xs mx-auto space-y-3">
                                    <div className="flex justify-between text-sm py-2 border-b border-[var(--color-border)]">
                                        <span className="text-[var(--color-text-muted)]">{t('version')}</span>
                                        <span className="font-mono">v1.0.0</span>
                                    </div>
                                    <div className="flex justify-between text-sm py-2 border-b border-[var(--color-border)]">
                                        <span className="text-[var(--color-text-muted)]">Build</span>
                                        <span className="font-mono">2026.1</span>
                                    </div>
                                    <div className="flex justify-between text-sm py-2">
                                        <span className="text-[var(--color-text-muted)]">GitHub</span>
                                        <a href="https://github.com/5lin/Tachyon" target="_blank" rel="noopener" className="text-[var(--color-accent)] hover:underline">5lin/Tachyon</a>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
