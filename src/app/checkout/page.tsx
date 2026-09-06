import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Suspense } from 'react'
import AuthGuard from '@/components/Auth/AuthGuard'
import { Checkout } from '@/components/Checkout/Checkout'

const inter = Inter({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700', '800'],
    variable: '--font-inter',
})

export const metadata: Metadata = {
    title: 'Checkout · Swippable',
    description: 'Test merchant checkout for Swippable virtual cards.',
    robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function CheckoutPage() {
    // Signed in only: the API will only ever charge the caller's own cards.
    return (
        <AuthGuard>
            <div className={inter.className}>
                {/* useSearchParams reads the Stripe return params, so it needs a boundary. */}
                <Suspense fallback={null}>
                    <Checkout />
                </Suspense>
            </div>
        </AuthGuard>
    )
}
