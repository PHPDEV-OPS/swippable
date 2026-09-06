'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import BrandLogo from '../BrandLogo'
import HeroArtwork from './HeroArtwork'

const leftAnimation = {
  initial: { x: '-100%', opacity: 0 },
  animate: { x: 0, opacity: 1 },
  transition: { duration: 0.6 },
}

const rightAnimation = {
  initial: { x: '100%', opacity: 0 },
  animate: { x: 0, opacity: 1 },
  transition: { duration: 0.6 },
}

const stats = [
  { value: 'Instant', label: 'Card issuing' },
  { value: 'M-Pesa', label: 'and USDC top-ups' },
  { value: 'Per-card', label: 'spending limits' },
]

const Hero = () => {
  return (
    <section className='relative z-1 overflow-hidden py-24 pt-40 sm:pt-48' id='main-banner'>
      {/* Brand wash behind the fold */}
      <div
        aria-hidden
        className='pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-40 blur-[140px]'
        style={{ background: 'radial-gradient(circle, #7042f4 0%, #12b88f 55%, transparent 75%)' }}
      />

      <div className='container relative'>
        <div className='grid grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-10'>
          <motion.div {...leftAnimation} className='flex flex-col gap-8'>
            <div className='flex flex-col gap-5 text-center md:text-left'>
              <div className='flex items-center justify-center lg:justify-start'>
                <span className='inline-flex items-center gap-2 rounded-full border border-white/10 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary'>
                  <ShieldCheck size={15} />
                  Secure payments for Africa
                </span>
              </div>

              <h1 className='text-center text-4xl font-medium text-white sm:text-5xl md:text-start md:text-6xl xl:text-[68px] xl:leading-[1.08]'>
                One wallet. <span className='text-primary'>Unlimited</span> virtual cards.
              </h1>

              <p className='text-lg text-white/70'>
                Top up once with M-Pesa or USDC, then issue virtual cards that all spend from the
                same balance &mdash; each with its own limit, pausable in a tap.
              </p>
            </div>

            <div className='flex flex-col items-center gap-4 sm:flex-row md:justify-start'>
              <Link
                href='/sign-up'
                className='flex items-center gap-2 rounded-lg border border-purple-500/30 bg-gradient-to-r from-[#6330cf] to-[#8553ec] px-7 py-3 font-semibold text-white shadow-lg shadow-purple-500/20 transition-all hover:opacity-95'>
                Get Started
                <ArrowRight size={18} />
              </Link>
              <Link
                href='/#work'
                className='rounded-lg border border-white/15 px-7 py-3 font-semibold text-white/80 transition-colors hover:border-white/30 hover:text-white'>
                See how it works
              </Link>
            </div>

            <dl className='grid grid-cols-3 gap-4 border-t border-white/10 pt-6 text-center md:text-left'>
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className='text-lg font-semibold text-white'>{stat.value}</dt>
                  <dd className='text-sm text-white/50'>{stat.label}</dd>
                </div>
              ))}
            </dl>
          </motion.div>

          <motion.div {...rightAnimation}>
            <HeroArtwork className='relative mx-auto w-full max-w-[584px]' />
          </motion.div>
        </div>

        <BrandLogo />
      </div>
    </section>
  )
}

export default Hero
