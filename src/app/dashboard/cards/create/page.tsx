import { Cards } from '@/components/Dashboard/Cards/Cards'

/**
 * The virtual card issuing terminal.
 *
 * Reuses the cards experience with the issuance flow already open rather than
 * maintaining a second copy of the form - one issuance path means one place for
 * the amount, colour and holder rules to live.
 *
 * Access is gated by the server layout alongside this file.
 */
export default function CreateCardPage() {
    return <Cards autoOpenCreate />
}
