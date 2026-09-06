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

    const isDashboard = pathname?.startsWith('/dashboard')
    // The command center brings its own rail, header and chrome.
    const isAdmin = pathname?.startsWith('/admin')
    const isAuth =
        pathname === '/signin' ||
        pathname === '/signup' ||
        pathname?.startsWith('/sign-in') ||
        pathname?.startsWith('/sign-up') ||
        pathname === '/forgot-password' ||
        pathname?.startsWith('/reset-password')

    // Hide header on dashboard and auth pages
    const hideHeader = isDashboard || isAuth || isAdmin
    // Hide footer and scroll-to-top on both dashboard and auth pages
    const hideFooterAndScroll = isDashboard || isAuth || isAdmin

    return (
        <>
            {!hideHeader && <Header />}
            {children}
            {!hideFooterAndScroll && <Footer />}
            {!hideFooterAndScroll && <ScrollToTop />}
        </>
    )
}
