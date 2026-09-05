import React from 'react'

export const UsdcBadge: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#2775CA" />
    <path
      d="M16.8 9.5C13.4 9.7 12 11.2 12 13.5C12 18.5 20.3 17 20.3 20.3C20.3 21.6 19.3 22.4 17.6 22.4C15.4 22.4 14.3 21.3 13.9 19.8H11.5C12 22.3 13.8 23.9 16.5 24.2V26H18.2V24.2C21.4 23.9 22.8 22.4 22.8 20.1C22.8 15 14.5 16.6 14.5 13.4C14.5 12.2 15.4 11.5 17 11.5C18.9 11.5 19.8 12.4 20.1 13.7H22.5C22.1 11.5 20.5 9.8 18.2 9.5V8H16.8V9.5Z"
      fill="white"
    />
  </svg>
)

export const UsdtBadge: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#26A17B" />
    <path
      d="M17.8 16.7V14.8H22.5V11.8H9.5V14.8H14.2V16.7C10.2 16.9 7.2 17.8 7.2 18.9C7.2 20.1 10.7 21 15.3 21.1C15.7 21.1 16.3 21.1 16.7 21.1C21.3 21 24.8 20.1 24.8 18.9C24.8 17.8 21.8 16.9 17.8 16.7ZM16 20.2C12.1 20.2 8.9 19.6 8.9 18.9C8.9 18.2 12.1 17.6 16 17.6C19.9 17.6 23.1 18.2 23.1 18.9C23.1 19.6 19.9 20.2 16 20.2Z"
      fill="white"
    />
    <path d="M16 21.3V25H17.5V21.3C17 21.3 16.5 21.3 16 21.3Z" fill="white" />
  </svg>
)

export const BaseBadge: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <div
    style={{ width: size, height: size }}
    className="rounded-full bg-[#0052FF] flex items-center justify-center p-0.5 shadow-sm"
    title="Base"
  >
    <svg viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="55.5" cy="55.5" r="55.5" fill="#0052FF" />
      <path
        d="M55.5 88C73.4493 88 88 73.4493 88 55.5C88 37.5507 73.4493 23 55.5 23C38.0867 23 23.8647 36.6575 23.0423 53.8696H65.8504V57.1304H23.0423C23.8647 74.3425 38.0867 88 55.5 88Z"
        fill="white"
      />
    </svg>
  </div>
)

export const ArbitrumBadge: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <div
    style={{ width: size, height: size }}
    className="rounded-full bg-[#28A0F0] flex items-center justify-center p-0.5 shadow-sm"
    title="Arbitrum"
  >
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path
        d="M50 18L77 64H63L50 42L42 56L36 45L50 22L50 18Z"
        fill="white"
      />
      <path
        d="M50 82L23 36H37L50 58L58 44L64 55L50 78L50 82Z"
        fill="white"
      />
    </svg>
  </div>
)

export const EthereumBadge: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <div
    style={{ width: size, height: size }}
    className="rounded-full bg-[#343434] flex items-center justify-center p-0.5 shadow-sm"
    title="Ethereum"
  >
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3/4 h-3/4">
      <path d="M16 4L9 16L16 20L23 16L16 4Z" fill="#C0CBF6" />
      <path d="M16 21.5L9 17.5L16 28L23 17.5L16 21.5Z" fill="#C0CBF6" />
      <path d="M16 4V20L23 16L16 4Z" fill="white" />
      <path d="M16 21.5V28L23 17.5L16 21.5Z" fill="white" />
    </svg>
  </div>
)

export const OptimismBadge: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <div
    style={{ width: size, height: size }}
    className="rounded-full bg-[#FF0420] flex items-center justify-center p-0.5 text-[9px] font-black text-white shadow-sm"
    title="Optimism"
  >
    OP
  </div>
)

export const PolygonBadge: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <div
    style={{ width: size, height: size }}
    className="rounded-full bg-[#8247E5] flex items-center justify-center p-0.5 shadow-sm"
    title="Polygon"
  >
    <svg viewBox="0 0 38 33" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3/4 h-3/4">
      <path
        d="M29 10.2L19 4.4L9 10.2V21.8L19 27.6L29 21.8V10.2ZM26.2 19.8L19 24L11.8 19.8V12.2L19 8L26.2 12.2V19.8Z"
        fill="white"
      />
    </svg>
  </div>
)

export const AvalancheBadge: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <div
    style={{ width: size, height: size }}
    className="rounded-full bg-[#E84142] flex items-center justify-center p-0.5 shadow-sm"
    title="Avalanche"
  >
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3/4 h-3/4">
      <path
        d="M19.6 7.2L24.5 15.6C25.2 16.8 24.3 18.4 22.9 18.4H13.1C11.7 18.4 10.8 16.8 11.5 15.6L16.4 7.2C17.1 6 18.9 6 19.6 7.2Z"
        fill="white"
      />
      <path
        d="M8.5 20.8L10.3 23.9C10.7 24.6 10.2 25.5 9.4 25.5H5.8C5 25.5 4.5 24.6 4.9 23.9L6.7 20.8C7.1 20.1 8.1 20.1 8.5 20.8Z"
        fill="white"
      />
      <path
        d="M23.5 20.8L25.3 23.9C25.7 24.6 25.2 25.5 24.4 25.5H20.8C20 25.5 19.5 24.6 19.9 23.9L21.7 20.8C22.1 20.1 23.1 20.1 23.5 20.8Z"
        fill="white"
      />
    </svg>
  </div>
)
