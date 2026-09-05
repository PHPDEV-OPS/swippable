import React from 'react'
import { cn } from '@/lib/utils'

/**
 * The Swippable loading state.
 *
 * A short dash-and-dot line pulses left to right beneath the logo mark - the
 * whole thing occupies a small block in the middle of the page rather than
 * filling it, so a brief load reads as a pause rather than a blank screen.
 *
 * Pure CSS (keyframes live in globals.css), so it renders on the server and
 * needs no client bundle or animation library.
 */

export interface BrandLoaderProps {
    /** Optional line under the mark, e.g. "Loading your wallet". */
    label?: string
    /** `page` centres it in the viewport; `inline` sits in normal flow. */
    variant?: 'page' | 'inline'
    className?: string
}

/** Bar widths and dot placement, matching the mark's proportions. */
const SEGMENTS = [
    { width: 34, dot: true },
    { width: 44, dot: true },
    { width: 28, dot: false },
]

export function BrandLoader({ label, variant = 'page', className }: BrandLoaderProps) {
    const content = (
        <div className={cn('flex flex-col items-center gap-4', className)}>
            {/* Logo mark, drawn inline so it needs no extra network request. */}
            <svg
                viewBox="0 0 64 64"
                className="h-9 w-9 animate-[swippable-mark_2.4s_ease-in-out_infinite]"
                role="img"
                aria-label="Swippable"
            >
                <polygon points="32,25 61,39 32,53 3,39" fill="#b9a4f7" />
                <polygon points="32,15.5 61,29.5 32,43.5 3,29.5" fill="#7042f4" />
                <polygon points="32,6 61,20 32,34 3,20" fill="#4a1fa8" />
            </svg>

            {/* Dash-and-dot line. */}
            <div className="flex items-center gap-1.5" aria-hidden="true">
                {SEGMENTS.map((segment, index) => (
                    <React.Fragment key={index}>
                        <span
                            className="block h-[5px] origin-left rounded-full bg-[var(--swippable-loader,#7042f4)] animate-[swippable-dash_1.25s_ease-in-out_infinite]"
                            style={{ width: segment.width, animationDelay: `${index * 0.16}s` }}
                        />
                        {segment.dot && (
                            <span
                                className="block h-[5px] w-[5px] rounded-full bg-[var(--swippable-loader,#7042f4)] animate-[swippable-dot_1.25s_ease-in-out_infinite]"
                                style={{ animationDelay: `${index * 0.16 + 0.08}s` }}
                            />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {label && (
                <p className="text-[11px] font-semibold tracking-wide text-[#81858c]">{label}</p>
            )}

            <span className="sr-only" role="status">
                {label ?? 'Loading'}
            </span>
        </div>
    )

    if (variant === 'inline') return content

    return <div className="flex min-h-[60vh] w-full items-center justify-center">{content}</div>
}

export default BrandLoader
