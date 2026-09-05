'use client'

import React, { useEffect, useState } from 'react'
import { Lottie } from 'lottie-react'
import { cn } from '@/lib/utils'

/**
 * Plays a Lottie scene exported from Jitter.
 *
 * The JSON is fetched at runtime rather than imported, so its embedded raster
 * assets never enter the JS bundle. The fetch also doubles as an existence
 * check: if the file is missing or is not a Lottie document, `fallback` is
 * rendered instead, so the section stays intact while the asset is added.
 */

export interface LottieSceneProps {
    /** Path under /public, e.g. "/animations/scene.json". */
    src: string
    /** Shown while loading, and permanently if the scene cannot be fetched. */
    fallback: React.ReactNode
    className?: string
    ariaLabel?: string
}

export function LottieScene({ src, fallback, className, ariaLabel }: LottieSceneProps) {
    const [data, setData] = useState<object | null>(null)
    const [failed, setFailed] = useState(false)
    const [reduceMotion, setReduceMotion] = useState(false)

    useEffect(() => {
        setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    }, [])

    useEffect(() => {
        let cancelled = false

        fetch(src)
            .then((response) => {
                if (!response.ok) throw new Error(String(response.status))
                return response.json()
            })
            .then((json) => {
                // A Lottie document always carries a layers array; anything else
                // (an HTML 404 page, say) counts as a missing asset.
                if (!json || !Array.isArray(json.layers)) throw new Error('not a lottie document')
                if (!cancelled) setData(json)
            })
            .catch(() => {
                if (!cancelled) setFailed(true)
            })

        return () => {
            cancelled = true
        }
    }, [src])

    if (failed || !data) return <>{fallback}</>

    return (
        <div
            className={cn(
                'w-full overflow-hidden rounded-[24px] border border-white/10 shadow-[0_30px_80px_-20px_rgba(76,29,190,0.45)]',
                className
            )}
            role="img"
            aria-label={ariaLabel}
        >
            {/* Held on the first frame when the viewer asks for reduced motion. */}
            <Lottie src={data} loop={!reduceMotion} autoplay={!reduceMotion} className="h-auto w-full" />
        </div>
    )
}

export default LottieScene
