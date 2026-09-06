'use client'

import Image from 'next/image'
import { useId } from 'react'

/**
 * The hero artwork, with only its green UI re-tinted to brand violet.
 *
 * A CSS `hue-rotate` would shift every hue in the image, turning the hand green
 * and the phone blue. Instead an SVG filter builds a mask of how *green* each
 * pixel is, hue-rotates a copy of the whole image, and then lays that copy back
 * over the original through the mask. Skin and the grey phone body score ~0 on
 * that mask, so they come through untouched; the card gradient, the line chart
 * and the progress ring score high and get the violet.
 */

/** Degrees to rotate. Green sits near 145, brand violet near 262. */
const HUE_SHIFT = 118

/**
 * How hard the green mask bites.
 *
 * `slope` sharpens the falloff so partly-green pixels commit one way or the
 * other; `intercept` lifts the floor off zero so faint colour noise in the
 * near-neutral areas is not tinted.
 */
const MASK_SLOPE = 3.4
const MASK_FLOOR = -0.1

interface HeroArtworkProps {
    className?: string
}

export function HeroArtwork({ className }: HeroArtworkProps) {
    // Filter ids are document-global, so scope this one to the instance.
    const filterId = `hero-green-to-brand-${useId().replace(/:/g, '')}`

    return (
        <div className={className}>
            <svg aria-hidden className="pointer-events-none absolute h-0 w-0">
                <defs>
                    {/*
                      sRGB rather than the linearRGB default: the thresholds
                      below were picked against the colours as they appear.
                    */}
                    <filter id={filterId} colorInterpolationFilters="sRGB">
                        {/*
                          Greenness -> alpha. G minus half of R and B, so a green
                          pixel scores high while any near-neutral colour, where
                          R, G and B are close, cancels out to roughly zero.
                          Skin is red-dominant and lands below zero.
                        */}
                        <feColorMatrix
                            in="SourceGraphic"
                            type="matrix"
                            values="0 0 0 0 0
                                    0 0 0 0 0
                                    0 0 0 0 0
                                    -0.5 1 -0.5 0 0"
                            result="greenness"
                        />
                        <feComponentTransfer in="greenness" result="sharpened">
                            <feFuncA type="linear" slope={MASK_SLOPE} intercept={MASK_FLOOR} />
                        </feComponentTransfer>

                        {/* Clip the mask to the artwork so transparent pixels
                            outside it can never pick up a tint. */}
                        <feComposite in="sharpened" in2="SourceGraphic" operator="in" result="mask" />

                        <feColorMatrix
                            in="SourceGraphic"
                            type="hueRotate"
                            values={String(HUE_SHIFT)}
                            result="rotated"
                        />
                        <feComposite in="rotated" in2="mask" operator="in" result="tinted" />

                        <feMerge>
                            <feMergeNode in="SourceGraphic" />
                            <feMergeNode in="tinted" />
                        </feMerge>
                    </filter>
                </defs>
            </svg>

            <Image
                src="/images/hero/hero-banner-img.png"
                alt="Swippable wallet and virtual card on mobile"
                width={584}
                height={582}
                priority
                className="h-auto w-full"
                style={{ filter: `url(#${filterId})` }}
            />
        </div>
    )
}

export default HeroArtwork
