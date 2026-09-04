'use client'

import { Inter } from 'next/font/google'
import { DashboardHeader } from '@/components/Dashboard/Header/Header'
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
            <div className={`min-h-screen ${inter.className} bg-[#f5f5f7] text-[#15151a] transition-colors duration-200 dark:bg-[#080808] dark:text-[#f3f4f6]`}>
                <DashboardHeader />
                <main className="mx-auto w-full max-w-[1440px] px-3 pt-24 pb-16 sm:px-6 sm:pt-28 md:pt-32 lg:px-8">
                    {children}
                </main>
                <AiChatButton />
            </div>
        </AuthGuard>
    )
}
