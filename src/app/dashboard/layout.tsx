'use client'

import { Sidebar } from '@/components/Dashboard/Sidebar/Sidebar';
import { DashboardHeader } from '@/components/Dashboard/Header/Header';
import { Overview } from '@/components/Dashboard/Overview/Overview';
import AuthGuard from '@/components/Auth/AuthGuard';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AuthGuard>
            <div className="h-screen bg-background flex overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    <DashboardHeader />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
                        {children}
                    </main>
                </div>
            </div>
        </AuthGuard>
    )
}
