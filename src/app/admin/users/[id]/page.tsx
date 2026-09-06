import { UserOverrideProfile } from '@/components/Admin/UserOverrideProfile'

export const dynamic = 'force-dynamic'

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return <UserOverrideProfile userId={id} />
}
