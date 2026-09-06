import { Suspense } from 'react'
import { TransactionRails } from '@/components/Admin/TransactionRails'
import { PanelLoader } from '@/components/Admin/primitives'

export const dynamic = 'force-dynamic'

export default function AdminTransactionsPage() {
    return (
        <Suspense fallback={<PanelLoader label="Scanning the rails" />}>
            <TransactionRails />
        </Suspense>
    )
}
