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
    <div className="min-h-screen lg:h-screen lg:max-h-screen w-full bg-white flex flex-col lg:flex-row font-sans selection:bg-[#7042f4]/20 selection:text-[#7042f4] overflow-x-hidden lg:overflow-hidden">
      {/* Left Column: Auth form area */}
      <div
        className="w-full lg:order-first lg:w-[46%] h-full flex flex-col justify-center items-center px-6 sm:px-8 lg:px-10 py-5 relative overflow-y-auto lg:overflow-hidden bg-white text-gray-900 [color-scheme:light]"
        style={{ colorScheme: 'light' }}
      >
        {/* Mobile Top Hero Banner (Only on mobile) */}
        <div className="w-full max-w-[500px] lg:hidden mb-6">
          <div className="rounded-2xl bg-[#7042f4] p-3.5 text-white flex items-center gap-3 shadow-md shadow-[#7042f4]/20">
            <div className="flex-shrink-0">
              <IsometricLayers size={36} />
            </div>
            <div>
              <span className="font-bold text-white text-sm sm:text-base">Stablecoin payments </span>
              <span className="font-normal text-white/75 text-sm sm:text-base">infrastructure</span>
            </div>
          </div>
        </div>

        {/* Center Auth Card Container - Exactly matches screenshot */}
        <div
          className="w-full max-w-[560px] mx-auto flex flex-col items-center justify-center my-auto py-5 [color-scheme:light]"
          style={{ colorScheme: 'light' }}
        >
          {/* Clerk Component Slot */}
          <div className="w-full flex justify-center [color-scheme:light]">{children}</div>
        </div>
      </div>

      {/* Right Column: Swippable product panel */}
      <div className="hidden lg:flex lg:order-last lg:w-[54%] h-full py-[5px] pr-[10px] pl-[5px] overflow-hidden">
        <div className="w-full h-full rounded-[28px] lg:rounded-[34px] bg-gradient-to-br from-[#7847eb] to-[#6733d7] text-white p-6 lg:p-8 xl:p-10 flex flex-col justify-between overflow-hidden shadow-2xl relative">
          {/* Subtle decorative glow */}
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-black/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar with Switch Link */}
          <div className="flex items-center justify-end relative z-10">
            <Link
              href={isSignIn ? '/sign-up' : '/sign-in'}
              className="flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-white tracking-tight transition-all shadow-sm hover:scale-102 active:scale-98"
            >
              {isSignIn ? (
                <>
                  <UserPlus size={13} className="text-white" />
                  <span>Create an account</span>
                </>
              ) : (
                <>
                  <LogIn size={13} className="text-white" />
                  <span>Sign in</span>
                </>
              )}
            </Link>
          </div>

          {/* Center Showcase Content */}
          <div className="flex flex-col items-center text-center my-auto py-2 relative z-10">
            {/* 3D Isometric Stack */}
            <IsometricLayers size={210} className="filter drop-shadow-xl" />

            {/* Pill Tag */}
            <div className="inline-flex items-center rounded-full bg-white/15 backdrop-blur-sm border border-white/20 px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white mt-4 mb-3">
              SWIPPABLE PAYMENTS
            </div>

            {/* Dual Headline */}
            <h2 className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight leading-snug">
              Move money without borders.
            </h2>
            <h3 className="text-2xl xl:text-3xl font-normal text-white/70 tracking-tight leading-snug mt-0.5">
              Keep your value in digital dollars.
            </h3>

            {/* Explanatory Body */}
            <p className="text-white/85 text-xs xl:text-sm leading-relaxed max-w-md mt-3.5">
              Swippable lets you pay with stablecoins, spend from one flexible wallet, and turn digital dollars into everyday money when you need it.
            </p>
            <p className="text-white/70 text-xs xl:text-sm leading-relaxed max-w-md mt-2">
              Secure cards, fast transfers, and a clearer view of your money in one place.
            </p>
          </div>

          {/* Bottom Badges Bar */}
          <div className="relative z-10">
            <div className="border-t border-dashed border-white/20 w-full mb-3.5" />
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-wider text-white/75">
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
