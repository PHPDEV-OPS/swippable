'use client'

import React from 'react'
import Link from 'next/link'
import { IsometricLayers } from './IsometricLayers'
import {
  UsdcBadge,
  UsdtBadge,
  BaseBadge,
  ArbitrumBadge,
  EthereumBadge,
  OptimismBadge,
  PolygonBadge,
  AvalancheBadge,
} from './NetworkBadges'
import { UserPlus, LogIn } from 'lucide-react'

interface AuthLayoutProps {
  children: React.ReactNode
  mode: 'sign-in' | 'sign-up'
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, mode }) => {
  const isSignIn = mode === 'sign-in'

  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen w-full bg-[#f7f7f8] flex flex-col lg:flex-row font-sans selection:bg-[#7042f4]/20 selection:text-[#7042f4] overflow-x-hidden lg:overflow-hidden">
      {/* Left Column: Auth form area */}
      <div
        className="w-full lg:order-first lg:w-[44%] h-full flex flex-col justify-center items-center px-6 sm:px-10 lg:px-14 py-8 relative overflow-y-auto lg:overflow-hidden bg-[#f7f7f8] text-gray-900 [color-scheme:light]"
        style={{ colorScheme: 'light' }}
      >
        {/* Mobile Top Hero Banner (Only on mobile) */}
        <div className="w-full max-w-[420px] lg:hidden mb-9">
          <div className="rounded-[22px] bg-gradient-to-br from-[#7847eb] to-[#6733d7] px-5 py-4 text-white flex items-center gap-3.5 shadow-lg shadow-[#7042f4]/25">
            <div className="flex-shrink-0">
              <IsometricLayers size={42} />
            </div>
            <div>
              <span className="font-bold text-white text-sm sm:text-base">Stablecoin payments </span>
              <span className="font-normal text-white/75 text-sm sm:text-base">infrastructure</span>
            </div>
          </div>
        </div>

        {/* Center Auth Card Container - Exactly matches screenshot */}
        <div
          className="w-full max-w-[420px] mx-auto flex flex-col items-center justify-center my-auto [color-scheme:light]"
          style={{ colorScheme: 'light' }}
        >
          {/* Clerk Component Slot */}
          <div className="w-full flex justify-center [color-scheme:light]">{children}</div>
        </div>
      </div>

      {/* Right Column: Swippable product panel */}
      <div className="hidden lg:flex lg:order-last lg:w-[56%] h-full p-3 overflow-hidden">
        <div className="w-full h-full rounded-[28px] lg:rounded-[32px] bg-gradient-to-br from-[#7847eb] to-[#6733d7] text-white p-7 lg:p-9 xl:p-11 flex flex-col justify-between overflow-hidden shadow-[0_18px_50px_rgba(112,66,244,0.22)] relative">
          {/* Subtle decorative glow */}
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-black/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar with Switch Link */}
          <div className="flex items-center justify-end relative z-10">
            <Link
              href={isSignIn ? '/sign-up' : '/sign-in'}
              className="flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 backdrop-blur-md px-4 py-2 text-[13px] font-semibold text-white tracking-tight transition-all shadow-sm hover:scale-102 active:scale-98"
            >
              {isSignIn ? (
                <>
                  <UserPlus size={14} className="text-white" />
                  <span>Create an account</span>
                </>
              ) : (
                <>
                  <LogIn size={14} className="text-white" />
                  <span>Sign in</span>
                </>
              )}
            </Link>
          </div>

          {/* Center Showcase Content */}
          <div className="flex flex-col items-center text-center my-auto py-2 relative z-10">
            {/* 3D Isometric Stack */}
            <IsometricLayers size={240} className="filter drop-shadow-xl" />

            {/* Pill Tag */}
            <div className="inline-flex items-center rounded-full bg-white/15 backdrop-blur-sm border border-white/20 px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white mt-7 mb-5">
              SWIPPABLE PAYMENTS
            </div>

            {/* Dual Headline */}
            <h2 className="text-[28px] xl:text-[34px] font-extrabold text-white tracking-tight leading-tight">
              Move money without borders.
            </h2>
            <h3 className="text-[28px] xl:text-[34px] font-normal text-white/60 tracking-tight leading-tight mt-1">
              Keep your value in digital dollars.
            </h3>

            {/* Explanatory Body */}
            <p className="text-white/85 text-[13.5px] xl:text-[15px] leading-relaxed max-w-lg mt-5">
              Swippable lets you pay with stablecoins, spend from one flexible wallet, and turn digital dollars into everyday money when you need it.
            </p>
            <p className="text-white/70 text-[13.5px] xl:text-[15px] leading-relaxed max-w-lg mt-3">
              Secure cards, fast transfers, and a clearer view of your money in one place.
            </p>
          </div>

          {/* Bottom Badges Bar */}
          <div className="relative z-10">
            <div className="border-t border-dashed border-white/25 w-full mb-4" />
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">
              {/* Accepted Tokens */}
              <div className="flex items-center gap-2">
                <span>ACCEPTED</span>
                <div className="flex items-center gap-1.5">
                  <UsdcBadge size={20} />
                  <UsdtBadge size={20} />
                </div>
              </div>

              {/* Supported Networks */}
              <div className="flex items-center gap-2">
                <span>NETWORKS</span>
                <div className="flex items-center gap-1.5">
                  <BaseBadge size={18} />
                  <ArbitrumBadge size={18} />
                  <EthereumBadge size={18} />
                  <OptimismBadge size={18} />
                  <PolygonBadge size={18} />
                  <AvalancheBadge size={18} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
