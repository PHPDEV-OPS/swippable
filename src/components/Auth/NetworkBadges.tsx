import React from 'react'

/**
 * Badges for the chains and wallets Swippable actually supports.
 *
 * The set is deliberately small. Sign-in accepts two web3 first factors -
 * `web3_base_signature` and `web3_coinbase_wallet_signature` - and deposits
 * settle in USDC on Base. Badges for Arbitrum, Ethereum, Optimism, Polygon,
 * Avalanche and USDT used to live here and were rendered on the auth pages,
 * which promised support the product does not have.
 */

export const UsdcBadge: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#2775CA" />
    <path
      d="M16.8 9.5C13.4 9.7 12 11.2 12 13.5C12 18.5 20.3 17 20.3 20.3C20.3 21.6 19.3 22.4 17.6 22.4C15.4 22.4 14.3 21.3 13.9 19.8H11.5C12 22.3 13.8 23.9 16.5 24.2V26H18.2V24.2C21.4 23.9 22.8 22.4 22.8 20.1C22.8 15 14.5 16.6 14.5 13.4C14.5 12.2 15.4 11.5 17 11.5C18.9 11.5 19.8 12.4 20.1 13.7H22.5C22.1 11.5 20.5 9.8 18.2 9.5V8H16.8V9.5Z"
      fill="white"
    />
  </svg>
)

export const BaseBadge: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <div
    style={{ width: size, height: size }}
    className="flex items-center justify-center rounded-full bg-[#0052FF] p-0.5 shadow-sm"
    title="Base"
  >
    <svg viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <circle cx="55.5" cy="55.5" r="55.5" fill="#0052FF" />
      <path
        d="M55.5 88C73.4493 88 88 73.4493 88 55.5C88 37.5507 73.4493 23 55.5 23C38.0867 23 23.8647 36.6575 23.0423 53.8696H65.8504V57.1304H23.0423C23.8647 74.3425 38.0867 88 55.5 88Z"
        fill="white"
      />
    </svg>
  </div>
)

/** Coinbase's mark: a rounded square knocked out of the brand-blue disc. */
export const CoinbaseWalletBadge: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <div
    style={{ width: size, height: size }}
    className="flex items-center justify-center rounded-full bg-[#0052FF] shadow-sm"
    title="Coinbase Wallet"
  >
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <circle cx="16" cy="16" r="16" fill="#0052FF" />
      <rect x="11.6" y="11.6" width="8.8" height="8.8" rx="2.1" fill="white" />
    </svg>
  </div>
)
