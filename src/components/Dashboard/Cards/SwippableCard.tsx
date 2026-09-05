'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { Check, Copy, Eye, EyeOff, Loader2, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VirtualCard } from '@/types/api'
import type { RevealedCard } from '@/lib/client-api'


/**
 * A payment card rendered at true ID-1 proportions (85.60 x 53.98 mm, the
 * ISO/IEC 7810 size of a real card), so it reads as a physical object rather
 * than a generic rounded rectangle.
 *
 * The face is an animated SVG - drifting colour waves, orbiting markers riding
 * motion paths, a bobbing orb and a periodic star glint - driven by a GSAP
 * timeline. Hovering flips the card to its back, where the full details can be
 * revealed and copied.
 */

/** 85.60mm / 53.98mm. Every card surface in the app derives its box from this. */
export const CARD_ASPECT_RATIO = 85.6 / 53.98

const VIEW_W = 600
const VIEW_H = Math.round(VIEW_W / CARD_ASPECT_RATIO) // 378

export interface SwippableCardProps {
    card: VirtualCard
    /** Full details, once the user has asked for them. */
    revealed?: RevealedCard | null
    revealing?: boolean
    revealError?: string | null
    onReveal?: () => void
    onHide?: () => void
    /** Set false for the decorative cards sitting behind the active one. */
    interactive?: boolean
    className?: string
}

export function SwippableCard({
    card,
    revealed = null,
    revealing = false,
    revealError = null,
    onReveal,
    onHide,
    interactive = true,
    className,
}: SwippableCardProps) {
    const [flipped, setFlipped] = useState(false)

    return (
        <div
            className={cn('group/card relative w-full [perspective:1600px]', className)}
            style={{ aspectRatio: `${CARD_ASPECT_RATIO}` }}
            onMouseEnter={() => interactive && setFlipped(true)}
            onMouseLeave={() => {
                if (!interactive) return
                setFlipped(false)
                onHide?.()
            }}
        >
            <div
                className="relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d]"
                style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
                {/* Front */}
                <div className="absolute inset-0 [backface-visibility:hidden]">
                    <CardFront card={card} animate={interactive} />
                </div>

                {/* Back */}
                <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">
                    <CardBack
                        card={card}
                        revealed={revealed}
                        revealing={revealing}
                        revealError={revealError}
                        onReveal={onReveal}
                    />
                </div>
            </div>

            {interactive && (
                <span className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-[#9a9ca4] opacity-0 transition-opacity duration-200 group-hover/card:opacity-100">
                    Hover to flip · reveal and copy details on the back
                </span>
            )}
        </div>
    )
}

/* ------------------------------------------------------------------ front */

function CardFront({ card, animate }: { card: VirtualCard; animate: boolean }) {
    const rootRef = useRef<SVGSVGElement>(null)

    // Every gradient, mask and clip path needs an id unique to this instance -
    // several cards share the document and SVG ids are global.
    const uid = useId().replace(/:/g, '')
    const ids = {
        chipMask: `chip-${uid}`,
        cardMask: `card-${uid}`,
        txtBoxes: `txt-${uid}`,
        orbClip: `orb-${uid}`,
        orb1: `orb1-${uid}`,
        orb2: `orb2-${uid}`,
        wave1: `wave1-${uid}`,
        wave2: `wave2-${uid}`,
        midC: `midc-${uid}`,
        innerC: `innerc-${uid}`,
        tri1: `tri1-${uid}`,
        tri2: `tri2-${uid}`,
        star: `star-${uid}`,
        sheen: `sheen-${uid}`,
    }

    useEffect(() => {
        const root = rootRef.current
        if (!root) return

        // Registered here rather than at module scope: these pages are
        // prerendered, and plugin setup belongs in the browser.
        gsap.registerPlugin(MotionPathPlugin)

        // Honour the OS setting: keep the art, drop the motion.
        const reduceMotion =
            typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

        const context = gsap.context(() => {
            if (reduceMotion || !animate) {
                gsap.set(root, { opacity: 1 })
                gsap.set(`#${ids.orb1}`, { y: 40 })
                return
            }

            const starShine = gsap
                .timeline({ paused: true })
                .set(`#${ids.star}`, { scale: 0, transformOrigin: '50% 50%', x: 2, y: 10 })
                .to(`#${ids.star}`, { scale: 1, repeat: 1, yoyo: true, duration: 0.4, ease: 'power4' }, 0)
                .fromTo(`#${ids.star}`, { rotate: -20 }, { rotate: 120, duration: 0.8, ease: 'none' }, 0)

            gsap
                .timeline()
                .set(root, { opacity: 1 })
                .set('.sc-scratches', { rotation: 70, x: 450, y: -10 })
                .set(`#${ids.tri2}`, { scale: 0.5 })
                .from(
                    '.sc-card-mask-rect',
                    { scale: 0, rotation: -20, duration: 1.6, transformOrigin: '50% 50%', ease: 'expo.inOut' },
                    0
                )
                .to(
                    `#${ids.tri1}`,
                    {
                        motionPath: {
                            path: `#${ids.midC}`,
                            align: `#${ids.midC}`,
                            alignOrigin: [0.5, 0.5],
                            autoRotate: true,
                            start: 1,
                            end: 0,
                        },
                        duration: 6,
                        repeat: -1,
                        ease: 'none',
                        repeatDelay: 1,
                    },
                    0.5
                )
                .to(
                    `#${ids.tri2}`,
                    {
                        motionPath: {
                            path: `#${ids.innerC}`,
                            align: `#${ids.innerC}`,
                            alignOrigin: [0.5, 0.5],
                            autoRotate: true,
                            start: 0,
                            end: 1,
                        },
                        duration: 5,
                        repeat: -1,
                        ease: 'none',
                        repeatDelay: 1,
                    },
                    1.5
                )
                .from(
                    '.sc-coil',
                    { attr: { 'stroke-dashoffset': (i: number) => (i === 1 ? -28 : 28) }, ease: 'none', duration: 1, repeat: -1 },
                    1
                )
                .fromTo(`#${ids.orb1}`, { y: 160 }, { y: -20, ease: 'circ', repeat: -1, yoyo: true, duration: 1 }, 0.8)
                .from('.sc-logo-pt', { x: (i: number) => [18, -10][i], duration: 1.2, ease: 'expo.inOut' }, 0.9)
                .from('.sc-text', { x: -40, duration: 1.1, ease: 'expo.inOut', stagger: 0.18 }, 1)
                .from('.sc-txt-box', { scaleX: 0, transformOrigin: '100% 0', duration: 1.1, ease: 'expo.inOut', stagger: 0.18 }, 1)
                .fromTo(`#${ids.wave1}`, { x: 0, y: 0 }, { duration: 5, x: -701, y: 815, repeat: -1, ease: 'none' }, 0)
                .fromTo(
                    `#${ids.wave2}`,
                    { x: 0, y: 0 },
                    {
                        duration: 6,
                        x: 804,
                        y: -917,
                        repeat: -1,
                        ease: 'none',
                        onRepeat: () => starShine.play(0),
                    },
                    0
                )
        }, root)

        return () => context.revert()
    }, [animate, ids.innerC, ids.midC, ids.orb1, ids.star, ids.tri1, ids.tri2, ids.wave1, ids.wave2])

    const paused = card.status !== 'ACTIVE'

    return (
        <div className="relative h-full w-full overflow-hidden rounded-[6.5%/10.3%] shadow-[0_18px_40px_-12px_rgba(60,26,140,0.55)]">
            <svg
                ref={rootRef}
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                className="h-full w-full opacity-0"
                preserveAspectRatio="xMidYMid slice"
                role="img"
                aria-label={`Virtual card ending ${card.last4}`}
            >
                <defs>
                    <mask id={ids.chipMask}>
                        <rect width="100%" height="100%" fill="#fff" />
                        <path
                            fill="none"
                            stroke="#000"
                            strokeWidth="3"
                            d="M98,133c0,0,4.3,0,7.2,0c2.8,0,3.8,2,3.8,4s-1,6-4,6H89 M109,176.2c0,0,3.5-2.7,3.5-8.7c0-4-4-10-9-10 s-15,0-15,0 M103.5,143.5V156 M136.8,133c0,0-7.3-0.5-7.1,5c0.1,2.6,1.8,5.5,6.3,5.5c5.3-0.1,14.9-0.5,14.9-0.5 M150.4,157.5 c0,0-10.1,0-15.1,0s-9.1,6-9.1,10c0,6,3.5,8.7,3.5,8.7 M135.3,143.5V156"
                        />
                    </mask>

                    <mask id={ids.cardMask}>
                        <rect className="sc-card-mask-rect" rx="24" ry="24" fill="#fff" width={VIEW_W} height={VIEW_H} />
                    </mask>

                    {/* Text slides in from behind these boxes, so it appears to unmask. */}
                    <clipPath id={ids.txtBoxes}>
                        <rect className="sc-txt-box" x="40" y="34" width="150" height="34" />
                        <rect className="sc-txt-box" x="40" y="212" width="420" height="46" />
                        <rect className="sc-txt-box" x="40" y="300" width="250" height="34" />
                        <rect className="sc-txt-box" x="440" y="300" width="120" height="34" />
                    </clipPath>

                    <clipPath id={ids.orbClip}>
                        <use href={`#${ids.orb1}`} />
                        <use href={`#${ids.orb2}`} />
                    </clipPath>

                    <linearGradient id={ids.sheen} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                        <stop offset="45%" stopColor="#ffffff" stopOpacity="0.18" />
                        <stop offset="55%" stopColor="#ffffff" stopOpacity="0.04" />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                    </linearGradient>
                </defs>

                <g mask={`url(#${ids.cardMask})`}>
                    {/* Deep violet ground, tuned to the dashboard's dark surface. */}
                    <rect fill="#1a1030" width="100%" height="100%" />

                    <g
                        fill="none"
                        stroke="#ffffff"
                        strokeOpacity="0.5"
                        strokeWidth="2"
                        strokeDasharray="6 2 4 2.5 4 3 3.5 3"
                    >
                        <path
                            className="sc-coil"
                            d="M306.1,671.4C62.6,602.5-79.4,350.4-10.9,108.3s295.2-372.5,538.7-303.6"
                        />
                        <path
                            id={ids.midC}
                            className="sc-coil"
                            d="M352.7,333.4c-79.2-30.9-137.8-142.9-100.6-235.7S386.5-16.5,449.6-11.7"
                        />
                        <path
                            id={ids.innerC}
                            className="sc-coil"
                            d="M404.4,221c-39.6-7.4-65.7-45.6-58.3-85.2s41.6-63.7,81.2-56.3"
                        />
                    </g>

                    <polygon id={ids.tri1} fill="#8553ec" points="0,47 0,0 44,22" />
                    <polygon id={ids.tri2} fill="#8553ec" points="0,47 0,0 44,22" />

                    <g fill="#7042f4">
                        <circle id={ids.orb1} cx="123" cy="410" r="105" />
                        <circle id={ids.orb2} cx="540" cy="45" r="134" />
                    </g>

                    {/* Teal and violet waves drift across the face on a loop. */}
                    <g fill="#12b88f">
                        <path
                            id={ids.wave2}
                            d="M-941,1510c89-58,147-115,211-201s142-153,210-195s144-42,208-86s69-130,70-173s5-129,38-193 c0,0,17.5-27.5,30.9-40.1C-159.6,609.4-137,593-137,593c89-58,147-115,211-201s142-153,210-195s144-42,208-86s69-130,70-173 s5-129,38-193v1765H-941z"
                        />
                    </g>
                    <g fill="#6330cf">
                        <path
                            id={ids.wave1}
                            d="M1551.5-1044.5c0,0-63,27-131,91s-122,185-186,244s-163,152.7-206,263.3s-90,162.7-128,189.7c0,0-14,10-26,16 c-16,8-24,11-24,11s-63,27-131,91s-122,185-186,244s-163,152.7-206,263.3c-9,23.2-18.2,43.9-27.5,62.3c56.5,0,1255.5-0.1,1255.5-0.1 L1551.5-1044.5z"
                        />
                    </g>

                    {/* Inside the orbs the same waves run in contrasting colours. */}
                    <g clipPath={`url(#${ids.orbClip})`}>
                        <use href={`#${ids.wave2}`} fill="#19c9a2" />
                        <use href={`#${ids.wave1}`} fill="#1a1030" />
                    </g>

                    <path
                        id={ids.star}
                        fill="#fff"
                        d="M397,17.6c3-3,6.1-9.1,6.1-9.1s0.8,3.8,4.5,7.6c6.1,6.1,9.1,6.1,9.1,6.1s-3,1.5-7.6,6.1 s-6.1,9.1-6.1,9.1s-2.3-5.3-6.1-9.1s-8.3-5.3-8.3-5.3S394,20.6,397,17.6z"
                    />

                    {/* Card scheme mark, bottom right. */}
                    <g transform="translate(0, 250)">
                        <circle className="sc-logo-pt" fill="#eb001b" cx="503" cy="67" r="22" />
                        <circle className="sc-logo-pt" fill="#f79e1b" fillOpacity="0.9" cx="533" cy="67" r="22" />
                    </g>

                    <g fill="#fff" strokeLinecap="round">
                        <g clipPath={`url(#${ids.txtBoxes})`}>
                            <text
                                className="sc-text"
                                x="44"
                                y="60"
                                fontSize="21"
                                fontWeight="700"
                                letterSpacing="1.5"
                            >
                                Swippable
                            </text>
                            <text
                                className="sc-text"
                                x="44"
                                y="248"
                                fontSize="30"
                                fontWeight="600"
                                letterSpacing="4"
                                style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                            >
                                {card.maskedPan}
                            </text>
                            <text className="sc-text" x="44" y="325" fontSize="19" letterSpacing="1.2">
                                {card.holder.toUpperCase().slice(0, 22)}
                            </text>
                            <text className="sc-text" x="440" y="325" fontSize="19" letterSpacing="1.2">
                                {card.expiry || '••/••'}
                            </text>
                        </g>

                        {/* Contactless arcs */}
                        <path
                            fill="none"
                            stroke="#fff"
                            strokeWidth="2.4"
                            d="M42.5,146.5c2,2,2,6.3,0,8.2 M57,163.7c5.1-5.9,5.1-19.8,0-26.3 M52.1,160.7c4.4-4.5,4.9-15.2,0-20.2 M47.8,157.2c2.9-3,2.9-10,0-13.2"
                        />

                        {/* EMV chip */}
                        <rect mask={`url(#${ids.chipMask})`} rx="5" ry="5" x="89" y="125" width="61" height="50.2" fill="#e8c77a" />
                    </g>

                    {/* Static gloss, so the card still catches light when motion is off. */}
                    <rect width="100%" height="100%" fill={`url(#${ids.sheen})`} />
                </g>
            </svg>

            {paused && (
                <div className="absolute inset-0 flex items-center justify-center rounded-[6.5%/10.3%] bg-[#1a1030]/70 backdrop-blur-[2px]">
                    <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                        <Lock size={12} />
                        Paused
                    </span>
                </div>
            )}
        </div>
    )
}

/* ------------------------------------------------------------------- back */

function CardBack({
    card,
    revealed,
    revealing,
    revealError,
    onReveal,
}: {
    card: VirtualCard
    revealed: RevealedCard | null
    revealing: boolean
    revealError: string | null
    onReveal?: () => void
}) {
    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[6.5%/10.3%] bg-gradient-to-br from-[#241546] via-[#1a1030] to-[#12092a] shadow-[0_18px_40px_-12px_rgba(60,26,140,0.55)]">
            {/* Magnetic stripe */}
            <div className="mt-[9%] h-[17%] w-full bg-[#0b0618]" />

            <div className="flex flex-1 flex-col justify-between px-[6%] pb-[5%] pt-[3.5%]">
                {/* Signature strip + CVV */}
                <div className="flex items-center gap-2">
                    <div className="flex h-[26px] flex-1 items-center rounded-[3px] bg-[repeating-linear-gradient(45deg,#efeaf7_0_6px,#e2daf0_6px_12px)] px-2">
                        <span className="truncate font-[cursive] text-[11px] italic text-[#4a3a6b]">
                            {card.holder}
                        </span>
                    </div>
                    <div className="flex h-[26px] min-w-[58px] items-center justify-center rounded-[3px] bg-white px-2">
                        <span className="font-mono text-[12px] font-bold tracking-widest text-[#1a1030]">
                            {revealed ? revealed.cvv : '•••'}
                        </span>
                    </div>
                </div>

                {/* Details */}
                <div className="space-y-[3%]">
                    <DetailRow
                        label="Card number"
                        value={revealed ? formatPan(revealed.pan) : card.maskedPan}
                        copyValue={revealed ? revealed.pan.replace(/\s/g, '') : null}
                        mono
                    />
                    <div className="flex gap-2">
                        <DetailRow label="Expires" value={revealed?.expiry ?? card.expiry ?? '••/••'} compact />
                        <DetailRow
                            label="CVV"
                            value={revealed?.cvv ?? '•••'}
                            copyValue={revealed?.cvv ?? null}
                            compact
                        />
                    </div>
                </div>

                {/* Reveal control */}
                <div className="flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={onReveal}
                        disabled={revealing}
                        className="flex items-center gap-1.5 rounded-lg bg-white/12 px-2.5 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-white/20 disabled:opacity-60"
                    >
                        {revealing ? (
                            <Loader2 size={12} className="animate-spin" />
                        ) : revealed ? (
                            <EyeOff size={12} />
                        ) : (
                            <Eye size={12} />
                        )}
                        {revealing ? 'Fetching…' : revealed ? 'Hide details' : 'Reveal details'}
                    </button>

                    <span className="text-[9px] font-medium text-white/45">•••• {card.last4}</span>
                </div>

                {revealError && (
                    <p className="rounded-lg bg-[#ef5362]/15 px-2 py-1 text-[9px] font-semibold leading-snug text-[#ff9aa4]">
                        {revealError}
                    </p>
                )}
            </div>
        </div>
    )
}

function DetailRow({
    label,
    value,
    copyValue,
    mono,
    compact,
}: {
    label: string
    value: string
    copyValue?: string | null
    mono?: boolean
    compact?: boolean
}) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        if (!copyValue) return
        try {
            await navigator.clipboard.writeText(copyValue)
            setCopied(true)
            setTimeout(() => setCopied(false), 1800)
        } catch {
            // Clipboard can be blocked by permissions; the value stays on screen.
        }
    }

    return (
        <div
            className={cn(
                'flex items-center justify-between gap-2 rounded-lg bg-white/[0.07] px-2.5 py-1.5',
                compact ? 'flex-1' : 'w-full'
            )}
        >
            <div className="min-w-0">
                <p className="text-[8px] font-bold uppercase tracking-wider text-white/45">{label}</p>
                <p
                    className={cn(
                        'truncate text-[12px] font-semibold text-white',
                        mono && 'font-mono tracking-[0.12em]'
                    )}
                >
                    {value}
                </p>
            </div>

            {copyValue && (
                <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 rounded-md p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label={`Copy ${label}`}
                >
                    {copied ? <Check size={12} className="text-[#28d6aa]" /> : <Copy size={12} />}
                </button>
            )}
        </div>
    )
}

/** Groups a raw PAN into the usual 4-digit blocks for display. */
function formatPan(pan: string): string {
    const digits = pan.replace(/\D/g, '')
    return digits.replace(/(.{4})/g, '$1 ').trim() || pan
}
