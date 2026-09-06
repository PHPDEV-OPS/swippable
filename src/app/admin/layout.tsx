import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AdminShell } from '@/components/Admin/AdminShell'

const inter = Inter({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700', '800'],
    variable: '--font-inter',
})

export const metadata: Metadata = {
    title: 'Command Center · Swippable',
    description: 'Superadmin controls for the Swippable virtual card platform.',
    // The command center should never be indexed or previewed anywhere.
    robots: { index: false, follow: false, nocache: true },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={inter.className}>
            <AdminShell>{children}</AdminShell>
        </div>
    )
}
