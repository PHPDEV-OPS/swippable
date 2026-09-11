'use client'

import React from 'react'
import Link from 'next/link'
import { IsometricLayers } from './IsometricLayers'
import { WalletSignInOptions } from './WalletSignInOptions'
import { UserPlus, LogIn } from 'lucide-react'

interface AuthLayoutProps {
  children: React.ReactNode
  mode: 'sign-in' | 'sign-up'
}

/**
 * The sign-in and sign-up frame.
 *
 * The form column owns a single vertical rhythm: one centred stack whose
 * spacing comes from one `gap`, rather than the previous mix of `my-auto` on
 * the card and a margin on the banner above it, which left the card sitting at
 * a different height on every breakpoint.
 */
export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, mode }) => {
  const isSignIn = mode === 'sign-in'

  return (
    <div className="flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-[#f7f7f8] font-sans selection:bg-[#7042f4]/20 selection:text-[#7042f4] lg:h-[100dvh] lg:max-h-[100dvh] lg:flex-row lg:overflow-hidden">
      {/* Form column */}
      <div
        className="relative flex w-full flex-col items-center bg-[#f7f7f8] px-5 pb-10 pt-[calc(1.75rem+env(safe-area-inset-top,0px))] text-gray-900 [color-scheme:light] sm:px-10 lg:order-first lg:w-[44%] lg:justify-center lg:overflow-y-auto lg:px-14 lg:py-12"
        style={{ colorScheme: 'light' }}
      >
        {/*
          `my-auto` centres the stack in the leftover space on a tall screen and
          simply collapses on a short one, so the card never gets pushed off the
          top of a phone the way a hard `justify-center` would.
        */}
        <div className="my-auto flex w-full max-w-[420px] flex-col items-center gap-8">
          {/* Brand band. The panel on the right carries this on desktop. */}
          <Link
            href="/"
            className="flex w-full items-center gap-3.5 rounded-[22px] bg-gradient-to-br from-[#7847eb] to-[#6733d7] px-5 py-4 text-white shadow-lg shadow-[#7042f4]/25 transition-transform active:scale-[0.99] lg:hidden"
          >
            <IsometricLayers size={42} />
            <span className="text-[15px] leading-snug">
              <span className="font-bold">Stablecoin payments </span>
              <span className="text-white/75">infrastructure</span>
            </span>
          </Link>

          <div className="flex w-full justify-center [color-scheme:light]">{children}</div>

          <WalletSignInOptions />
        </div>
      </div>

      {/* Product panel */}
      <div className="hidden p-3 lg:order-last lg:flex lg:h-full lg:w-[56%] lg:overflow-hidden">
        <div className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[32px] bg-gradient-to-br from-[#7847eb] to-[#6733d7] p-9 text-white shadow-[0_18px_50px_rgba(112,66,244,0.22)] xl:p-11">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-black/10 blur-3xl" />

          <div className="relative z-10 flex items-center justify-end">
            <Link
              href={isSignIn ? '/sign-up' : '/sign-in'}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-4 py-2 text-[13px] font-semibold tracking-tight text-white shadow-sm backdrop-blur-md transition-all hover:scale-102 hover:bg-white/25 active:scale-98"
            >
              {isSignIn ? (
                <>
                  <UserPlus size={14} />
                  <span>Create an account</span>
                </>
              ) : (
                <>
                  <LogIn size={14} />
                  <span>Sign in</span>
                </>
              )}
            </Link>
          </div>

          {/*
            One headline, not two. The second line used to repeat the first at
            the same size in 60% white, which read as a rendering fault rather
            than a deliberate pair.
          */}
          <div className="relative z-10 my-auto flex flex-col items-center py-2 text-center">
            <IsometricLayers size={220} className="drop-shadow-xl" />

            <h2 className="mt-9 max-w-xl text-[30px] font-extrabold leading-[1.12] tracking-tight xl:text-[36px]">
              Move money without borders.
            </h2>

            <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-white/85 xl:text-[15px]">
              Pay with stablecoins, spend from one flexible wallet, and turn digital dollars
              into everyday money when you need it.
            </p>
            <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-white/70 xl:text-[15px]">
              Secure cards, fast transfers, and a clearer view of your money in one place.
            </p>
          </div>

          <div className="relative z-10">
            <div className="mb-4 w-full border-t border-dashed border-white/25" />
            <p className="text-[12.5px] leading-relaxed text-white/70">
              Top up with M-Pesa or USDC on Base, then issue as many virtual cards as you
              need &mdash; every one of them spends from the same balance.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
