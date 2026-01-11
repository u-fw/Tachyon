import { createContext, useContext, useState, type ReactNode } from 'react'

export type ViewMode = 'grid' | 'list'

interface SettingsContextType {
    // Appearance
    viewMode: ViewMode
    setViewMode: (mode: ViewMode) => void

    // Pagination
    itemsPerPage: number
    setItemsPerPage: (count: number) => void

    // Reader
    preloadCount: number
    setPreloadCount: (count: number) => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
    // 1. View Mode
    const [viewMode, setViewModeState] = useState<ViewMode>(() => {
        const saved = localStorage.getItem('tachyon-view')
        return (saved === 'list' ? 'list' : 'grid') as ViewMode
    })

    const setViewMode = (mode: ViewMode) => {
        setViewModeState(mode)
        localStorage.setItem('tachyon-view', mode)
    }

    // 2. Pagination
    const [itemsPerPage, setItemsPerPageState] = useState(() => {
        const saved = localStorage.getItem('tachyon-per-page')
        return saved ? parseInt(saved, 10) : 36
    })

    const setItemsPerPage = (count: number) => {
        setItemsPerPageState(count)
        localStorage.setItem('tachyon-per-page', count.toString())
    }

    // 3. Reader Preload
    const [preloadCount, setPreloadCountState] = useState(() => {
        const saved = localStorage.getItem('tachyon-preload-count')
        return saved ? parseInt(saved, 10) : 3
    })

    const setPreloadCount = (count: number) => {
        setPreloadCountState(count)
        localStorage.setItem('tachyon-preload-count', count.toString())
    }

    return (
        <SettingsContext.Provider
            value={{
                viewMode,
                setViewMode,
                itemsPerPage,
                setItemsPerPage,
                preloadCount,
                setPreloadCount,
            }}
        >
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    const context = useContext(SettingsContext)
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider')
    }
    return context
}
