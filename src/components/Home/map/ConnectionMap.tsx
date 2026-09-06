'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'
import { WORLD_DOTS, decodeWorldDots, project } from './world-dots'

/**
 * Dotted world map with animated settlement corridors.
 *
 * Two layers, as the reference does: a <canvas> paints the ~2,700 land dots
 * (far cheaper than the same number of DOM nodes), and an <svg> on top carries
 * the arcs, ripples and hit targets so they stay crisp and animatable.
 *
 * The land itself comes from real Natural Earth polygons, baked to a bitmask by
 * scripts/generate-world-dots.mjs, so nothing geographic is drawn by hand.
 */

/** Panel aspect, matching the reference component. */
const VIEW_W = 119.5
const VIEW_H = 51.23

export interface MapCity {
    id: string
    name: string
    lon: number
    lat: number
    /** Live markers pulse; planned ones sit quietly. */
    status: 'live' | 'planned'
    /** Nudges the label off the node so it clears the coastline. */
    label?: { dx?: number; dy?: number; align?: 'left' | 'right' }
}

export interface MapArc {
    from: string
    to: string
    /** Seconds, so the corridors do not all fire at once. */
    delay?: number
}

interface ConnectionMapProps {
    cities: MapCity[]
    arcs: MapArc[]
    className?: string
}

export function ConnectionMap({ cities, arcs, className }: ConnectionMapProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    /** City positions in viewBox units, resolved once. */
    const nodes = useMemo(() => {
        const byId = new Map<string, MapCity & { x: number; y: number; nx: number; ny: number }>()
        cities.forEach((city) => {
            const { x, y } = project(city.lon, city.lat)
            byId.set(city.id, { ...city, nx: x, ny: y, x: x * VIEW_W, y: y * VIEW_H })
        })
        return byId
    }, [cities])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const cells = decodeWorldDots()
        const { width: cols, height: rows } = WORLD_DOTS

        // Grid coordinates of each city, so dots near one can be tinted.
        const hubs = cities.map((city) => {
            const { x, y } = project(city.lon, city.lat)
            return { gx: x * cols, gy: y * rows, live: city.status === 'live' }
        })

        const draw = () => {
            const context = canvas.getContext('2d')
            if (!context) return

            const cssWidth = canvas.clientWidth
            const cssHeight = canvas.clientHeight
            if (!cssWidth || !cssHeight) return

            const ratio = window.devicePixelRatio || 1
            canvas.width = Math.round(cssWidth * ratio)
            canvas.height = Math.round(cssHeight * ratio)

            context.setTransform(ratio, 0, 0, ratio, 0, 0)
            context.clearRect(0, 0, cssWidth, cssHeight)

            const cellW = cssWidth / cols
            const cellH = cssHeight / rows
            const radius = Math.max(0.55, Math.min(cellW, cellH) * 0.34)

            for (let row = 0; row < rows; row += 1) {
                for (let col = 0; col < cols; col += 1) {
                    if (!cells[row * cols + col]) continue

                    // Nearest hub decides the tint, so the African corridor glows.
                    let influence = 0
                    let live = false
                    for (const hub of hubs) {
                        const distance = Math.hypot(col - hub.gx, row - hub.gy)
                        const weight = Math.max(0, 1 - distance / 7)
                        if (weight > influence) {
                            influence = weight
                            live = hub.live
                        }
                    }

                    // A stable hash gives a few brighter dots without flicker.
                    const sparkle = ((col * 73856093) ^ (row * 19349663)) % 97 === 0

                    if (influence > 0.05) {
                        const alpha = 0.25 + influence * 0.75
                        context.fillStyle = live
                            ? `rgba(150, 110, 240, ${alpha})`
                            : `rgba(120, 96, 190, ${alpha * 0.75})`
                    } else if (sparkle) {
                        context.fillStyle = 'rgba(255, 255, 255, 0.5)'
                    } else {
                        context.fillStyle = 'rgba(255, 255, 255, 0.11)'
                    }

                    context.beginPath()
                    context.arc((col + 0.5) * cellW, (row + 0.5) * cellH, radius, 0, Math.PI * 2)
                    context.fill()
                }
            }
        }

        draw()

        const observer = new ResizeObserver(draw)
        observer.observe(canvas)
        return () => observer.disconnect()
    }, [cities])

    return (
        <div
            className={cn('relative w-full select-none', className)}
            style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
        >
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />

            <svg
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                className="absolute inset-0 h-full w-full overflow-hidden"
                role="img"
                aria-label={`Swippable settlement corridors between ${cities.map((c) => c.name).join(', ')}`}
            >
                <defs>
                    <linearGradient id="swp-arc" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(138, 99, 210, 0.08)" />
                        <stop offset="55%" stopColor="rgba(160, 120, 235, 0.55)" />
                        <stop offset="100%" stopColor="#CBB4F0" />
                    </linearGradient>
                    <radialGradient id="swp-node-glow">
                        <stop offset="0%" stopColor="#CBB4F0" stopOpacity="0.55" />
                        <stop offset="100%" stopColor="#8A63D2" stopOpacity="0" />
                    </radialGradient>
                </defs>

                {arcs.map((arc, index) => {
                    const from = nodes.get(arc.from)
                    const to = nodes.get(arc.to)
                    if (!from || !to) return null

                    // Lift the control point above both ends so the arc bows out
                    // rather than cutting straight across the globe.
                    const lift = Math.max(4, Math.abs(to.x - from.x) * 0.28)
                    const d = `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${Math.min(from.y, to.y) - lift} ${to.x} ${to.y}`
                    const delay = `${arc.delay ?? index * 0.9}s`

                    return (
                        <g key={`${arc.from}-${arc.to}`}>
                            {/* pathLength normalises the dash maths, so every arc
                                draws at the same rate whatever its real length. */}
                            <path
                                d={d}
                                pathLength={1}
                                className="swp-arc"
                                style={{ animationDelay: delay }}
                            />
                            <path
                                d={d}
                                pathLength={1}
                                className="swp-arc-pulse"
                                style={{ animationDelay: delay }}
                            />
                        </g>
                    )
                })}

                {[...nodes.values()].map((city) => (
                    <g key={city.id}>
                        {city.status === 'live' && (
                            <>
                                <circle cx={city.x} cy={city.y} r={2.6} fill="url(#swp-node-glow)" />
                                <circle cx={city.x} cy={city.y} r={0.7} className="swp-ripple" />
                            </>
                        )}
                        <circle
                            cx={city.x}
                            cy={city.y}
                            r={city.status === 'live' ? 0.62 : 0.45}
                            fill={city.status === 'live' ? '#EDE4FF' : '#9B7BE0'}
                        />
                    </g>
                ))}
            </svg>

            {/* Labels sit in the DOM rather than the SVG so they never scale with
                the viewBox and stay legible at every width. */}
            {[...nodes.values()].map((city) => (
                <span
                    key={city.id}
                    className={cn(
                        'pointer-events-none absolute hidden -translate-y-1/2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] sm:block',
                        city.status === 'live' ? 'text-white' : 'text-white/55'
                    )}
                    style={{
                        left: `calc(${city.nx * 100}% + ${city.label?.dx ?? 1.2}%)`,
                        top: `calc(${city.ny * 100}% + ${city.label?.dy ?? 0}%)`,
                        transform:
                            city.label?.align === 'right'
                                ? 'translate(-100%, -50%)'
                                : undefined,
                    }}
                >
                    {city.name}
                </span>
            ))}
        </div>
    )
}

export default ConnectionMap
