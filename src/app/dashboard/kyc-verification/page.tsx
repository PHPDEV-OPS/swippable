import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '@/lib/auth'
import { normaliseKycStatus } from '@/lib/kyc'
import { isKycVerified } from '@/types/api'
import { KycVerificationForm } from '@/components/Dashboard/Kyc/KycVerificationForm'

export const dynamic = 'force-dynamic'

/**
 * Identity verification screen.
 *
 * A server component so the current KYC state is read from Neon on every load
 * rather than from a client cache that may be stale - the whole point of this
 * page is that it reflects the row the card gate will actually consult.
 */
export default async function KycVerificationPage({
    searchParams,
}: {
    searchParams: Promise<{ returnTo?: string }>
}) {
    const user = await getAuthenticatedUser()
    if (!user) redirect('/sign-in')

    // Nothing to do here once verified - send them on rather than offering a
    // form whose only possible outcome is "already verified".
    if (isKycVerified(user.kyc_status)) redirect('/dashboard/cards')

    const { returnTo } = await searchParams
    const status = normaliseKycStatus(user.kyc_status)

    return (
        <div className='mx-auto w-full max-w-2xl'>
            <header className='mb-8'>
                <p className='text-[10px] font-bold uppercase tracking-wider text-[#7042f4]'>
                    Step 1 of 2
                </p>
                <h1 className='mt-2 text-2xl font-extrabold tracking-tight text-[#15151a] dark:text-white'>
                    Verify your identity
                </h1>
                <p className='mt-2 text-xs font-medium leading-relaxed text-[#777984] dark:text-[#888a93]'>
                    Kenyan regulation requires us to confirm who you are before we can issue a card or move
                    money on your behalf. Enter your details exactly as they appear on your National ID.
                </p>
            </header>

            <div className='rounded-2xl border border-black/[0.05] bg-white p-6 shadow-sm dark:border-white/[0.08] dark:bg-[#111114] sm:p-8'>
                <KycVerificationForm status={status} returnTo={safeReturnTo(returnTo)} />
            </div>
        </div>
    )
}

/**
 * Only ever redirect to a path inside this app. Taking the query parameter at
 * face value would turn this page into an open redirect - a phisher could send
 * `?returnTo=https://evil.example` and bounce a freshly verified user off-site.
 */
function safeReturnTo(value: string | undefined): string {
    if (!value) return '/dashboard/cards/create'
    // A leading `//` or `/\` is protocol-relative and leaves the origin.
    if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
        return '/dashboard/cards/create'
    }
    return value
}
