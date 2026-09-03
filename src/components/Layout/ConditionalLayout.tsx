'use client'

import { usePathname } from 'next/navigation'
import Header from './Header'
import Footer from './Footer'
import ScrollToTop from '@/components/ScrollToTop'

export default function ConditionalLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()

    // Define routes where we don't want certain layout elements
    const isDashboard = pathname?.startsWith('/dashboard')
    const isAuth = pathname === '/signin' || pathname === '/signup' || pathname === '/forgot-password' || pathname?.startsWith('/reset-password')

    // Show header on auth pages but hide it on dashboard
    const hideHeader = isDashboard
    // Hide footer and scroll-to-top on both dashboard and auth pages
    const hideFooterAndScroll = isDashboard || isAuth

    return (
        <>
            {!hideHeader && <Header />}
            {children}
            {!hideFooterAndScroll && <Footer />}
            {!hideFooterAndScroll && <ScrollToTop />}
        </>
    )
}
