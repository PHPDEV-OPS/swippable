import { requireVerifiedKycPage } from '@/lib/kyc'

// Never statically rendered or cached: the gate below must re-read the live
// `kyc_status` on every request, not serve a decision made for someone else.
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * KYC gate for the virtual card issuing terminal.
 *
 * A layout rather than a check inside the page, so it runs before any child
 * route under /dashboard/cards/create renders - a page added here later is
 * gated by construction rather than by remembering to add a guard to it.
 *
 * This protects the view. The matching enforcement lives in
 * POST /api/cards/issue, which is what actually stops an unverified account
 * from getting a card whether or not a browser ever honoured this redirect.
 */
export default async function CreateCardLayout({ children }: { children: React.ReactNode }) {
    await requireVerifiedKycPage()
    return <>{children}</>
}
