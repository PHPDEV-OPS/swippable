import { Suspense } from 'react'
import { CardLifecycle } from '@/components/Admin/CardLifecycle'
import { PanelLoader } from '@/components/Admin/primitives'

export const dynamic = 'force-dynamic'

export default function AdminCardsPage() {
    return (
        <Suspense fallback={<PanelLoader label="Loading cards" />}>
            <CardLifecycle />
        </Suspense>
    )
}
