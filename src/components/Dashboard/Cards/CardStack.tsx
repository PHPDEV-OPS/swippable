'use client'

import React, { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { CARD_ASPECT_RATIO, SwippableCard } from './SwippableCard'
import { ApiRequestError, useRevealCard, type RevealedCard } from '@/lib/client-api'
import type { VirtualCard } from '@/types/api'

/**
 * The card carousel.
 *
 * The active card sits in front, fully animated and flippable. The cards behind
 * it are stacked back into depth, tilted and dimmed. Clicking the stack rotates
 * the next card forward and sends the current one to the back, so the order
 * cycles rather than reshuffling.
 */

interface CardStackProps {
    cards: VirtualCard[]
    activeIndex: number
    onActiveIndexChange: (index: number) => void
}

/** How far back each successive card sits. */
const DEPTH = [
    { y: 0, scale: 1, rotate: 0, opacity: 1, blur: 0 },
    { y: -22, scale: 0.93, rotate: -3.5, opacity: 0.72, blur: 1 },
    { y: -40, scale: 0.86, rotate: 3, opacity: 0.45, blur: 2 },
]

export function CardStack({ cards, activeIndex, onActiveIndexChange }: CardStackProps) {
    const reveal = useRevealCard()
    const [revealed, setRevealed] = useState<RevealedCard | null>(null)
    const [revealError, setRevealError] = useState<string | null>(null)

    const total = cards.length
    const active = total > 0 ? cards[activeIndex % total] : null

    const clearReveal = useCallback(() => {
        setRevealed(null)
        setRevealError(null)
    }, [])

    const advance = () => {
        if (total < 2) return
        clearReveal()
        onActiveIndexChange((activeIndex + 1) % total)
    }

    const handleReveal = async () => {
        if (!active) return

        // Second press hides again - the values are dropped, not just covered.
        if (revealed) {
            clearReveal()
            return
        }

        setRevealError(null)
        try {
            const result = await reveal.mutateAsync(active.cardId)
            setRevealed(result)
        } catch (error) {
            const message =
                error instanceof ApiRequestError ? error.message : 'Could not retrieve the card details'
            setRevealError(message)
            toast.error(message, { duration: 6000 })
        }
    }

    if (total === 0) return null

    // Render back-to-front so the active card paints last and sits on top.
    const layers = Array.from({ length: Math.min(total, DEPTH.length) }, (_, offset) => {
        const index = (activeIndex + offset) % total
        return { card: cards[index], offset }
    }).reverse()

    return (
        <div className="relative w-full select-none" style={{ aspectRatio: `${CARD_ASPECT_RATIO}` }}>
            {/* Reserve room for the tilted cards behind the active one. */}
            <div className="absolute inset-x-0 -top-[12%] bottom-0">
                {layers.map(({ card, offset }) => {
                    const depth = DEPTH[offset]
                    const isActive = offset === 0

                    return (
                        <motion.div
                            key={card.cardId}
                            className="absolute inset-x-0 top-[12%]"
                            initial={false}
                            animate={{
                                y: depth.y,
                                scale: depth.scale,
                                rotate: depth.rotate,
                                opacity: depth.opacity,
                                zIndex: DEPTH.length - offset,
                            }}
                            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                            style={{
                                filter: depth.blur ? `blur(${depth.blur}px)` : undefined,
                                pointerEvents: isActive ? 'auto' : 'none',
                            }}
                        >
                            <SwippableCard
                                card={card}
                                interactive={isActive}
                                revealed={isActive ? revealed : null}
                                revealing={isActive && reveal.isPending}
                                revealError={isActive ? revealError : null}
                                onReveal={isActive ? handleReveal : undefined}
                                onHide={isActive ? clearReveal : undefined}
                            />
                        </motion.div>
                    )
                })}
            </div>

            {/* Cycle control. Sits below the card so it never blocks the flip. */}
            {total > 1 && (
                <div className="absolute -bottom-11 left-1/2 flex -translate-x-1/2 items-center gap-2">
                    <button
                        type="button"
                        onClick={advance}
                        className="rounded-full bg-[#f5f5f7] px-3 py-1 text-[10px] font-bold text-[#6330cf] transition-colors hover:bg-[#ece7fb] dark:bg-white/[0.08] dark:text-[#c4a8ff] dark:hover:bg-white/[0.14]"
                    >
                        Next card
                    </button>
                    <div className="flex items-center gap-1">
                        {cards.map((card, index) => (
                            <button
                                key={card.cardId}
                                type="button"
                                onClick={() => {
                                    clearReveal()
                                    onActiveIndexChange(index)
                                }}
                                aria-label={`Show card ending ${card.last4}`}
                                className={`h-1.5 rounded-full transition-all ${
                                    index === activeIndex % total
                                        ? 'w-4 bg-[#7042f4]'
                                        : 'w-1.5 bg-[#d6d7de] hover:bg-[#b3a4e8] dark:bg-white/20'
                                }`}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
