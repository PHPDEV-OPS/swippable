import React from 'react'
import { BaseBadge, CoinbaseWalletBadge } from './NetworkBadges'

/**
 * The wallet options that actually work.
 *
 * These two are not a marketing list - they are the `web3_wallet` first
 * factors the Clerk instance has enabled (`web3_base_signature` and
 * `web3_coinbase_wallet_signature`). The page previously advertised six
 * networks, five of which nothing in the product could sign in with or
 * receive a deposit on.
 */

const WALLETS = [
    { name: 'Base', badge: BaseBadge },
    { name: 'Coinbase Wallet', badge: CoinbaseWalletBadge },
]

export const WalletSignInOptions: React.FC = () => (
    <div className="w-full max-w-[420px]">
        <div className="border-t border-dashed border-[#d9d9e0]" />

        <p className="mt-5 text-center text-[13px] font-semibold text-[#18181b]">
            Sign in with a wallet
        </p>

        <ul className="mt-3 flex items-center justify-center gap-2">
            {WALLETS.map(({ name, badge: Badge }) => (
                <li
                    key={name}
                    className="flex items-center gap-2 rounded-full bg-[#f4f4f6] py-1.5 pl-1.5 pr-3.5 text-[13px] font-semibold text-[#3f3f46]"
                >
                    <Badge size={22} />
                    <span>{name}</span>
                </li>
            ))}
        </ul>

        <p className="mt-3 text-center text-[12.5px] leading-relaxed text-[#71717a]">
            Or link one later from Settings. Deposits arrive as USDC on Base.
        </p>
    </div>
)
