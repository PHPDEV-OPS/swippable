import { Suspense } from 'react'
import { UsersConsole } from '@/components/Admin/UsersConsole'
import { PanelLoader } from '@/components/Admin/primitives'

export const dynamic = 'force-dynamic'

export default function AdminUsersPage() {
    // useSearchParams needs a Suspense boundary to keep the route streamable.
    return (
        <Suspense fallback={<PanelLoader label="Loading accounts" />}>
            <UsersConsole />
        </Suspense>
    )
}
