'use client'

import { Inter } from 'next/font/google'
import { DashboardHeader } from '@/components/Dashboard/Header/Header'
import { MobileTabBar } from '@/components/Dashboard/Navigation/MobileTabBar'
import AuthGuard from '@/components/Auth/AuthGuard'
import { AiChatButton } from '@/components/Dashboard/AiChat/AiChatButton'

const inter = Inter({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700', '800'],
    variable: '--font-inter'
})

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AuthGuard>
            <div className={`min-h-[100dvh] ${inter.className} bg-[#f5f5f7] text-[#15151a] transition-colors duration-200 dark:bg-[#080808] dark:text-[#f3f4f6]`}>
                <DashboardHeader />
                {/*
                  The top pad clears the fixed title bar plus the status bar on a
                  notched phone; the bottom pad reserves exactly the height of
                  the floating tab bar so the last row of content is never
                  trapped underneath it.
                */}
                <main className="mx-auto w-full max-w-[1440px] px-4 pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] pt-[calc(4.5rem+env(safe-area-inset-top,0px))] sm:px-6 lg:px-8 lg:pb-16 lg:pt-32">
                    {children}
                </main>
                <MobileTabBar />
                <AiChatButton />
            </div>
        </AuthGuard>
    )
}
