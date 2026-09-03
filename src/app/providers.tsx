'use client'

import { ThemeProvider } from 'next-themes'
import { SessionProvider } from 'next-auth/react'
import { ReactNode, useState } from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from '@/lib/wagmi'
import { OnchainKitProvider } from '@coinbase/onchainkit'
import { WalletProvider } from '@coinbase/onchainkit/wallet'
import { base } from 'wagmi/chains'

export function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient())

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <OnchainKitProvider
                    apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
                    chain={base}
                >
                    <WalletProvider>
                        <SessionProvider>
                            <ThemeProvider
                                attribute='class'
                                enableSystem={true}
                                defaultTheme='system'
                            >
                                {children}
                            </ThemeProvider>
                        </SessionProvider>
                    </WalletProvider>
                </OnchainKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    )
}
