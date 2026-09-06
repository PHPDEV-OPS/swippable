'use client'

import React, { useEffect, useState } from 'react'
import { Lottie } from 'lottie-react'
import { cn } from '@/lib/utils'

/**
 * Plays a Lottie scene exported from Jitter.
 *
 * The JSON is fetched at runtime rather than imported, so its embedded raster
 * assets never enter the JS bundle. Scenes authored on a light ground can be
 * re-themed with `palette`, which rewrites the solid fills in place - no
 * re-export needed when the site's theme changes.
 */

type Rgb = readonly [number, number, number]

/** A solid fill to find, and what to paint instead. Values are 0-1. */
export interface PaletteSwap {
    from: Rgb
    to: Rgb
}

/**
 * Recolours the light Jitter export for the dark landing page.
 *
 * The page ground and the inset chips share one source colour, which is what we
 * want here: on a dark theme an inset sits *darker* than the card it lives in,
 * so both mapping to the deepest violet reads correctly.
 */
export const DARK_SCENE_PALETTE: PaletteSwap[] = [
    // #F2F4F8 page ground and inset chips -> deepest violet
    { from: [0.949, 0.957, 0.973], to: [0.059, 0.043, 0.118] },
    // white cards -> raised panel
    { from: [1, 1, 1], to: [0.106, 0.082, 0.2] },
    // black type -> white
    { from: [0, 0, 0], to: [1, 1, 1] },
    // muted grey type -> lilac grey
    { from: [0.549, 0.573, 0.651], to: [0.616, 0.592, 0.722] },
    // pale mint chip -> deep teal
    { from: [0.941, 0.984, 0.973], to: [0.043, 0.208, 0.173] },
]

const TOLERANCE = 0.02

function matches(value: number[], target: Rgb): boolean {
    return target.every((channel, index) => Math.abs((value[index] ?? -1) - channel) < TOLERANCE)
}

/**
 * Walks the document and swaps solid fill colours.
 *
 * Only `c` values with a static `k` triple are touched, so gradients, opacity
 * tracks and effect parameters (drop shadows and the like) are left alone.
 */
function recolor<T>(node: T, palette: PaletteSwap[]): T {
    if (Array.isArray(node)) return node.map((item) => recolor(item, palette)) as T
    if (!node || typeof node !== 'object') return node

    const output: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        const colour = value as { a?: number; k?: unknown } | null

        if (
            key === 'c' &&
            colour &&
            typeof colour === 'object' &&
            colour.a === 0 &&
            Array.isArray(colour.k) &&
            colour.k.length >= 3 &&
            colour.k.every((channel) => typeof channel === 'number')
        ) {
            const channels = colour.k as number[]
            const swap = palette.find((entry) => matches(channels, entry.from))
            output[key] = swap
                ? { ...colour, k: [...swap.to, ...channels.slice(3)] }
                : value
            continue
        }

        output[key] = recolor(value, palette)
    }

    return output as T
}

export interface LottieSceneProps {
    /** Path under /public, e.g. "/animations/scene.json". */
    src: string
    /** Optional fill swaps applied once, after the document loads. */
    palette?: PaletteSwap[]
    /** Width / height of the scene, used to hold layout while it loads. */
    aspectRatio?: number
    className?: string
    ariaLabel?: string
}

export function LottieScene({ src, palette, aspectRatio, className, ariaLabel }: LottieSceneProps) {
    const [data, setData] = useState<object | null>(null)
    const [reduceMotion, setReduceMotion] = useState(false)

    useEffect(() => {
        setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    }, [])

    useEffect(() => {
        let cancelled = false

        fetch(src)
            .then((response) => response.json())
            .then((json) => {
                if (cancelled) return
                setData(palette ? recolor(json, palette) : json)
            })
            .catch((error) => console.error(`[lottie] could not load ${src}`, error))

        return () => {
            cancelled = true
        }
        // `palette` is a module-level constant at every call site.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src])

    return (
        <div
            className={cn('w-full overflow-hidden', className)}
            style={aspectRatio ? { aspectRatio: `${aspectRatio}` } : undefined}
            role={ariaLabel ? 'img' : undefined}
            aria-label={ariaLabel}
        >
            {/* Held on the first frame when the viewer asks for reduced motion. */}
            {data && (
                <Lottie src={data} loop={!reduceMotion} autoplay={!reduceMotion} className="h-auto w-full" />
            )}
        </div>
    )
}

export default LottieScene
