'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import {
    CardLimitsIllustration,
    DashboardPreviewIllustration,
    WalletActivityIllustration,
    WalletPhoneIllustration,
} from '../illustrations'

/**
 * Real product screenshots for the landing page.
 *
 * Each shot falls back to the drawn SVG illustration if its file is missing, so
 * the page never renders a broken image while assets are being added. Drop the
 * captures at the paths in SHOTS and they take over automatically.
 */

export const SHOTS = {
    dashboard: '/images/showcase/dashboard.png',
    wallet: '/images/showcase/wallet.png',
    cards: '/images/showcase/cards.png',
    card: '/images/showcase/card.png',
    mobile: '/images/showcase/mobile.png',
} as const

interface AppShotProps {
    src: string
    alt: string
    width: number
    height: number
    fallback: React.ReactNode
    className?: string
    priority?: boolean
}

/** Screenshot with a graceful fallback to the drawn equivalent. */
function AppShot({ src, alt, width, height, fallback, className, priority }: AppShotProps) {
    const [failed, setFailed] = useState(false)

    if (failed) return <>{fallback}</>

    return (
        <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            priority={priority}
            onError={() => setFailed(true)}
            className={cn('h-auto w-full', className)}
        />
    )
}

/** Desktop browser chrome, so a screenshot reads as a real product surface. */
function BrowserFrame({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                'overflow-hidden rounded-xl border border-white/10 bg-[#0d0a18] shadow-[0_30px_80px_-20px_rgba(76,29,190,0.45)]',
                className
            )}
        >
            <div className='flex items-center gap-2 border-b border-white/[0.07] bg-white/[0.03] px-4 py-2.5'>
                <span className='h-2.5 w-2.5 rounded-full bg-[#ff5f57]' />
                <span className='h-2.5 w-2.5 rounded-full bg-[#febc2e]' />
                <span className='h-2.5 w-2.5 rounded-full bg-[#28c840]' />
                <span className='ml-3 hidden rounded-md bg-white/[0.06] px-3 py-1 text-[10px] font-medium text-white/40 sm:block'>
                    app.swippable.com
                </span>
            </div>
            {children}
        </div>
    )
}

/** Phone bezel for the mobile capture. */
function PhoneFrame({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                'overflow-hidden rounded-[2rem] border-[6px] border-[#1b1630] bg-[#0d0a18] shadow-[0_24px_60px_-14px_rgba(76,29,190,0.55)]',
                className
            )}
        >
            {children}
        </div>
    )
}

/** Gentle idle float, offset per element so the group never moves in lockstep. */
const float = (delay = 0) => ({
    animate: { y: [0, -10, 0] },
    transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' as const, delay },
})

/* ------------------------------------------------------------------ hero */

export function HeroShowcase({ className }: { className?: string }) {
    return (
        <div className={cn('relative mx-auto w-full max-w-[620px]', className)}>
            {/* Dashboard, angled slightly so it sits in space rather than flat. */}
            <motion.div {...float(0)} className='relative'>
                <BrowserFrame>
                    <AppShot
                        src={SHOTS.dashboard}
                        alt='Swippable dashboard showing wallet balance, cards and activity'
                        width={1920}
                        height={1580}
                        priority
                        fallback={<WalletPhoneIllustration className='h-auto w-full' />}
                    />
                </BrowserFrame>
            </motion.div>

            {/* Mobile view, tucked into the lower-left corner. */}
            <motion.div
                {...float(1.4)}
                className='absolute -bottom-10 -left-6 w-[26%] max-w-[150px] sm:-left-10 sm:w-[28%]'>
                <PhoneFrame>
                    <AppShot
                        src={SHOTS.mobile}
                        alt='Swippable on mobile'
                        width={347}
                        height={600}
                        fallback={
                            <div className='aspect-[347/600] w-full bg-gradient-to-br from-[#2a1b52] to-[#12092a]' />
                        }
                    />
                </PhoneFrame>
            </motion.div>

            {/* The card itself, floating out over the frame. */}
            <motion.div
                initial={{ opacity: 0, y: 20, rotate: -10 }}
                animate={{ opacity: 1, y: 0, rotate: -6 }}
                transition={{ duration: 0.7, delay: 0.35, ease: 'easeOut' }}
                className='absolute -right-4 bottom-2 w-[42%] max-w-[250px] drop-shadow-[0_18px_36px_rgba(38,16,90,0.55)] sm:-right-8'>
                <motion.div {...float(0.7)}>
                    <AppShot
                        src={SHOTS.card}
                        alt='Swippable virtual card'
                        width={443}
                        height={281}
                        fallback={
                            <div className='aspect-[443/281] w-full rounded-xl bg-gradient-to-br from-[#622fcf] via-[#824fed] to-[#12b88f]' />
                        }
                    />
                </motion.div>
            </motion.div>
        </div>
    )
}

/* ------------------------------------------------------ section showcases */

interface SectionShotProps {
    className?: string
}

export function WalletShowcase({ className }: SectionShotProps) {
    return (
        <motion.div {...float(0.3)} className={cn('mx-auto w-full max-w-[540px]', className)}>
            <BrowserFrame>
                <AppShot
                    src={SHOTS.wallet}
                    alt='Swippable wallet: balance, liquidity split and deposit history'
                    width={1829}
                    height={2000}
                    fallback={<WalletActivityIllustration className='h-auto w-full' />}
                />
            </BrowserFrame>
        </motion.div>
    )
}

export function DashboardShowcase({ className }: SectionShotProps) {
    return (
        <motion.div {...float(0.6)} className={cn('mx-auto w-full max-w-[620px]', className)}>
            <BrowserFrame>
                <AppShot
                    src={SHOTS.dashboard}
                    alt='Swippable dashboard with spending analytics and recent transactions'
                    width={1920}
                    height={1580}
                    fallback={<DashboardPreviewIllustration className='h-auto w-full' />}
                />
            </BrowserFrame>
        </motion.div>
    )
}

export function CardsShowcase({ className }: SectionShotProps) {
    return (
        <div className={cn('relative mx-auto w-full max-w-[580px]', className)}>
            <motion.div {...float(0.2)}>
                <BrowserFrame>
                    <AppShot
                        src={SHOTS.cards}
                        alt='Swippable cards page with per-card limits and management'
                        width={1920}
                        height={1200}
                        fallback={<CardLimitsIllustration className='h-auto w-full' />}
                    />
                </BrowserFrame>
            </motion.div>

            <motion.div
                {...float(1.1)}
                className='absolute -bottom-8 -left-4 w-[36%] max-w-[210px] drop-shadow-[0_16px_32px_rgba(38,16,90,0.5)] sm:-left-8'>
                <AppShot
                    src={SHOTS.card}
                    alt='Swippable virtual card'
                    width={443}
                    height={281}
                    fallback={
                        <div className='aspect-[443/281] w-full rounded-xl bg-gradient-to-br from-[#622fcf] via-[#824fed] to-[#12b88f]' />
                    }
                />
            </motion.div>
        </div>
    )
}
