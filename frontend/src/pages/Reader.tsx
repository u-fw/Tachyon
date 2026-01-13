import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { fetchPages, API_BASE, type PagesResponse } from '../lib/api'
import { useI18n } from '../contexts/I18nContext'
import { useSettings } from '../contexts/SettingsContext'
import SettingsModal from '../components/SettingsModal'

export default function Reader() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { t } = useI18n()

    const [comic, setComic] = useState<PagesResponse | null>(null)
    const [currentPage, setCurrentPage] = useState(0)
    const [loading, setLoading] = useState(true)
    const [imageLoading, setImageLoading] = useState(true)
    const [showThumbnails, setShowThumbnails] = useState(false)

    // Page transition animation
    const [slideDirection, setSlideDirection] = useState<'none' | 'left' | 'right'>('none')
    const [isTransitioning, setIsTransitioning] = useState(false)

    // Zoom state
    const [scale, setScale] = useState(1)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const dragStart = useRef({ x: 0, y: 0 })
    const dragStartPos = useRef({ x: 0, y: 0 })

    // Preloaded images
    const preloadedRef = useRef<Set<number>>(new Set())

    const imageContainerRef = useRef<HTMLDivElement>(null)
    const thumbnailsRef = useRef<HTMLDivElement>(null)

    // Fetch comic data
    useEffect(() => {
        if (!id) return

        fetchPages(id)
            .then((data) => {
                setComic(data)
                setLoading(false)

                const saved = localStorage.getItem(`tachyon-progress-${id}`)
                if (saved) {
                    const page = parseInt(saved, 10)
                    if (!isNaN(page) && page < data.pageCount) {
                        setCurrentPage(page)
                    }
                }
            })
            .catch(() => navigate('/'))
    }, [id, navigate])

    // Save progress
    useEffect(() => {
        if (id && comic) {
            localStorage.setItem(`tachyon-progress-${id}`, currentPage.toString())
        }
    }, [id, comic, currentPage])



    const { preloadCount } = useSettings()
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    // Preload images
    useEffect(() => {
        if (!id || !comic) return

        const toPreload = new Set<number>()
        // Always preload previous page
        if (currentPage > 0) toPreload.add(currentPage - 1)

        // Preload next N pages
        const max = preloadCount === -1 ? comic.pageCount : preloadCount
        for (let i = 0; i < max; i++) {
            const next = currentPage + 1 + i
            if (next < comic.pageCount) {
                toPreload.add(next)
            }
        }

        toPreload.forEach((page) => {
            if (!preloadedRef.current.has(page)) {
                const img = new Image()
                img.src = `${API_BASE}${comic.pages[page].url}`
                img.onload = () => preloadedRef.current.add(page)
            }
        })
    }, [id, comic, currentPage, preloadCount])

    // Reset zoom on page change
    useEffect(() => {
        setScale(1)
        setPosition({ x: 0, y: 0 })
        setImageLoading(!preloadedRef.current.has(currentPage))
    }, [currentPage])

    // Scroll thumbnail into view
    useEffect(() => {
        if (showThumbnails && thumbnailsRef.current) {
            const thumb = thumbnailsRef.current.children[currentPage] as HTMLElement
            thumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        }
    }, [currentPage, showThumbnails])

    // Navigation with animation
    const goNext = useCallback(() => {
        if (comic && currentPage < comic.pageCount - 1 && !isTransitioning) {
            setSlideDirection('left')
            setIsTransitioning(true)
            setTimeout(() => {
                setCurrentPage(p => p + 1)
                setSlideDirection('none')
                setIsTransitioning(false)
            }, 150)
        }
    }, [comic, currentPage, isTransitioning])

    const goPrev = useCallback(() => {
        if (currentPage > 0 && !isTransitioning) {
            setSlideDirection('right')
            setIsTransitioning(true)
            setTimeout(() => {
                setCurrentPage(p => p - 1)
                setSlideDirection('none')
                setIsTransitioning(false)
            }, 150)
        }
    }, [currentPage, isTransitioning])

    const goToPage = (page: number) => {
        if (page >= 0 && page < (comic?.pageCount || 0) && page !== currentPage) {
            setIsTransitioning(true)
            setTimeout(() => {
                setCurrentPage(page)
                setIsTransitioning(false)
            }, 100)
        }
    }

    // Zoom
    const zoomIn = () => setScale(s => Math.min(s * 1.25, 5))
    const zoomOut = () => {
        setScale(s => {
            const newScale = Math.max(s / 1.25, 1)
            if (newScale === 1) setPosition({ x: 0, y: 0 })
            return newScale
        })
    }
    const resetZoom = () => {
        setScale(1)
        setPosition({ x: 0, y: 0 })
    }

    // Mouse drag for panning (when zoomed) or page flip (when not zoomed)
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return
        setIsDragging(true)
        dragStart.current = { x: e.clientX, y: e.clientY }
        dragStartPos.current = { ...position }
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return
        if (scale > 1) {
            setPosition({
                x: dragStartPos.current.x + (e.clientX - dragStart.current.x),
                y: dragStartPos.current.y + (e.clientY - dragStart.current.y),
            })
        }
    }

    const handleMouseUp = (e: React.MouseEvent) => {
        if (!isDragging) return
        const dx = e.clientX - dragStart.current.x
        setIsDragging(false)

        if (scale === 1 && Math.abs(dx) > 80) {
            dx > 0 ? goPrev() : goNext()
        }
    }

    // Direct wheel zoom (no Ctrl required)
    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault()
        if (e.deltaY < 0) {
            setScale(s => Math.min(s * 1.1, 5))
        } else {
            setScale(s => {
                const newScale = Math.max(s / 1.1, 1)
                if (newScale === 1) setPosition({ x: 0, y: 0 })
                return newScale
            })
        }
    }, [])

    // Attach wheel event with passive: false to prevent page zoom
    useEffect(() => {
        const container = imageContainerRef.current
        if (container) {
            container.addEventListener('wheel', handleWheel, { passive: false })
            return () => container.removeEventListener('wheel', handleWheel)
        }
    }, [handleWheel])

    // Touch handlers
    const lastTouchDist = useRef(0)

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX
            const dy = e.touches[0].clientY - e.touches[1].clientY
            lastTouchDist.current = Math.sqrt(dx * dx + dy * dy)
        } else if (e.touches.length === 1) {
            dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
            dragStartPos.current = { ...position }
        }
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX
            const dy = e.touches[0].clientY - e.touches[1].clientY
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (lastTouchDist.current > 0) {
                setScale(s => Math.max(1, Math.min(s * (dist / lastTouchDist.current), 5)))
            }
            lastTouchDist.current = dist
        } else if (e.touches.length === 1 && scale > 1) {
            setPosition({
                x: dragStartPos.current.x + (e.touches[0].clientX - dragStart.current.x),
                y: dragStartPos.current.y + (e.touches[0].clientY - dragStart.current.y),
            })
        }
    }

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (e.changedTouches.length === 1 && scale === 1) {
            const dx = dragStart.current.x - e.changedTouches[0].clientX
            if (Math.abs(dx) > 60) {
                dx > 0 ? goNext() : goPrev()
            }
        }
        lastTouchDist.current = 0
    }

    // Click to navigate
    const handleImageClick = (e: React.MouseEvent) => {
        if (isDragging) return
        const rect = imageContainerRef.current?.getBoundingClientRect()
        if (!rect) return

        const x = (e.clientX - rect.left) / rect.width
        if (x < 0.3) goPrev()
        else if (x > 0.7) goNext()
    }

    // Keyboard
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowRight': case 'd': case 'D': goNext(); break
                case 'ArrowLeft': case 'a': case 'A': goPrev(); break
                case 'Escape': scale > 1 ? resetZoom() : navigate('/'); break
                case 't': case 'T': setShowThumbnails(p => !p); break
                case '+': case '=': zoomIn(); break
                case '-': zoomOut(); break
                case '0': resetZoom(); break
            }
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [goNext, goPrev, navigate, scale])

    if (loading) {
        return (
            <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        )
    }

    if (!comic || !id) return null

    const progress = ((currentPage + 1) / comic.pageCount) * 100

    // Animation classes for page transition
    const getImageAnimationClass = () => {
        if (isTransitioning) {
            return slideDirection === 'left'
                ? 'opacity-0 -translate-x-8'
                : slideDirection === 'right'
                    ? 'opacity-0 translate-x-8'
                    : 'opacity-50'
        }
        return 'opacity-100 translate-x-0'
    }

    return (
        <div className="fixed inset-0 bg-neutral-950 flex flex-col select-none">
            {/* Top Bar - Independent area */}
            <header className="flex-shrink-0 bg-neutral-900 border-b border-neutral-800 z-50">
                <div className="h-14 px-4 sm:px-8 flex items-center w-full">
                    {/* Back */}
                    <Link
                        to="/"
                        className="flex-shrink-0 flex items-center gap-2 px-3 py-2 -ml-2 rounded-lg hover:bg-neutral-800 transition-colors"
                    >
                        <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-neutral-300 text-sm font-medium hidden sm:inline">{t('back')}</span>
                    </Link>

                    {/* Title + Page Counter */}
                    <div className="flex-1 flex items-center justify-center gap-3 min-w-0 mx-4">
                        <h1 className="text-neutral-200 font-medium text-sm truncate">
                            {comic.name}
                        </h1>
                        <div className="flex-shrink-0 flex items-center gap-1 text-sm">
                            <span className="text-white font-semibold">{currentPage + 1}</span>
                            <span className="text-neutral-500">/</span>
                            <span className="text-neutral-400">{comic.pageCount}</span>
                        </div>
                    </div>

                    {/* Settings Button */}
                    <div className="relative">
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                            title={t('settings')}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* Image Area - Takes remaining space */}
            <div
                ref={imageContainerRef}
                className="flex-1 relative overflow-hidden bg-black"
                style={{ cursor: isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'default' }}
                onClick={handleImageClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => setIsDragging(false)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Loading Spinner */}
                {imageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    </div>
                )}

                {/* Comic Image with transition */}
                <div
                    className={`absolute inset-0 flex items-center justify-center transition-all duration-150 ease-out ${getImageAnimationClass()}`}
                    style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
                >
                    <img
                        key={currentPage}
                        src={`${API_BASE}${comic.pages[currentPage]?.url}`}
                        alt={`${currentPage + 1}`}
                        onLoad={() => setImageLoading(false)}
                        draggable={false}
                        className={`max-h-full max-w-full object-contain transition-opacity duration-200 ${imageLoading ? 'opacity-0' : 'opacity-100'
                            }`}
                    />
                </div>

                {/* Side Navigation Hints */}
                {scale === 1 && (
                    <>
                        {currentPage > 0 && (
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 hover:opacity-60 transition-opacity">
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </div>
                            </div>
                        )}
                        {currentPage < comic.pageCount - 1 && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 hover:opacity-60 transition-opacity">
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Bottom Bar - Independent area */}
            <footer className="flex-shrink-0 bg-neutral-900 border-t border-neutral-800 z-50">
                <div className="w-full px-4 sm:px-8 py-3 space-y-3">
                    {/* Progress Bar */}
                    <div className="relative group">
                        <div
                            className="h-1.5 bg-neutral-700 rounded-full cursor-pointer overflow-hidden"
                            onClick={(e) => {
                                e.stopPropagation()
                                const rect = e.currentTarget.getBoundingClientRect()
                                const percent = (e.clientX - rect.left) / rect.width
                                goToPage(Math.round(percent * (comic.pageCount - 1)))
                            }}
                        >
                            <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-200"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        {/* Progress Handle */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                            style={{ left: `calc(${progress}% - 6px)` }}
                        />
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between">
                        {/* Left: Navigation */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); goPrev() }}
                                disabled={currentPage === 0}
                                className="w-10 h-10 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-800 flex items-center justify-center transition-colors"
                            >
                                <svg className="w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); goNext() }}
                                disabled={currentPage === comic.pageCount - 1}
                                className="w-10 h-10 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-800 flex items-center justify-center transition-colors"
                            >
                                <svg className="w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>

                        {/* Center: Zoom */}
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-800">
                            <button
                                onClick={(e) => { e.stopPropagation(); zoomOut() }}
                                disabled={scale <= 1}
                                className="w-8 h-8 rounded hover:bg-neutral-700 disabled:opacity-30 flex items-center justify-center transition-colors"
                            >
                                <svg className="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                            </button>
                            <span className="text-neutral-300 text-xs font-medium w-12 text-center">
                                {Math.round(scale * 100)}%
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); zoomIn() }}
                                disabled={scale >= 5}
                                className="w-8 h-8 rounded hover:bg-neutral-700 disabled:opacity-30 flex items-center justify-center transition-colors"
                            >
                                <svg className="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                            {scale > 1 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); resetZoom() }}
                                    className="w-8 h-8 rounded hover:bg-neutral-700 flex items-center justify-center transition-colors ml-1"
                                    title="重置"
                                >
                                    <svg className="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Right: Thumbnails */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowThumbnails(!showThumbnails) }}
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${showThumbnails
                                ? 'bg-indigo-600 text-white'
                                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                        </button>
                    </div>

                    {/* Thumbnails Panel */}
                    {showThumbnails && (
                        <div
                            ref={thumbnailsRef}
                            className="flex gap-2 py-2 overflow-x-auto"
                            style={{ scrollbarWidth: 'thin' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {Array.from({ length: comic.pageCount }, (_, i) => (
                                <button
                                    key={i}
                                    onClick={() => goToPage(i)}
                                    className={`relative flex-shrink-0 w-14 h-20 rounded-lg overflow-hidden transition-all ${i === currentPage
                                        ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-neutral-900'
                                        : 'opacity-60 hover:opacity-100'
                                        }`}
                                >
                                    <img
                                        src={`${API_BASE}${comic.pages[i]?.url}`}
                                        alt={`${i + 1}`}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent py-0.5">
                                        <span className="text-white text-xs font-medium">{i + 1}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </footer>

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                initialTab="reader"
            />
        </div>
    )
}
