'use client'

import { useEffect, useState } from 'react'

/**
 * Reads a media query in React state.
 *
 * Layout should be done in CSS wherever it can be, but behaviour cannot: a
 * bottom sheet drags to dismiss on a phone and an anchored popover does not,
 * and that difference has to be known in JavaScript.
 *
 * Returns `false` on the server and for the first client paint, so callers get
 * markup that matches the server render and never hydrate-mismatch.
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false)

    useEffect(() => {
        const list = window.matchMedia(query)
        const update = () => setMatches(list.matches)
        update()
        list.addEventListener('change', update)
        return () => list.removeEventListener('change', update)
    }, [query])

    return matches
}

/**
 * True from Tailwind's `lg` breakpoint up - the width at which the dashboard
 * swaps its phone shell (title bar plus tab dock) for the desktop one.
 */
export function useIsDesktop(): boolean {
    return useMediaQuery('(min-width: 1024px)')
}
