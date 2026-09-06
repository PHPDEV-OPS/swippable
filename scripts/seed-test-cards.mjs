/**
 * Seeds the two well-known sandbox test cards onto an account, plus enough
 * wallet balance to actually authorise against them.
 *
 * These are the card numbers Stripe and Flutterwave publish for testing. They
 * are public, belong to nobody, and move no real money - which is exactly why
 * they are safe to hard-code here and useless anywhere outside a sandbox.
 *
 * The rows are marked `stripe_test` / `flutterwave_test` rather than `stripe` /
 * `flutterwave`, because no issuer ever minted them: there is no provider-side
 * record to reveal, pause or re-limit. `providerOf` maps them to `sandbox`, so
 * the reveal flow correctly says there is nothing to fetch instead of calling
 * an API that would 404.
 *
 * Idempotent - re-running updates the existing rows rather than duplicating.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-test-cards.mjs [email]
 */
import { neon } from '@neondatabase/serverless'

const EMAIL = process.argv[2] ?? 'swippable@gmail.com'

/** Wallet credit, so the cards have something to authorise against. */
const WALLET_TOP_UP = '2000.00'
/** Allocation per card. */
const CARD_LIMIT = '500.00'

const TEST_CARDS = [
    {
        cardId: 'swp_test_stripe_4242',
        provider: 'stripe_test',
        brand: 'VISA',
        last4: '4242',
        // Stripe's universal test card.
        pan: '4242424242424242',
        expiry: '12/34',
        cvv: 'any 3 digits',
        type: 'Stripe test card',
        color: 'from-[#4f3cff] via-[#6355ff] to-[#7a5cff]',
    },
    {
        cardId: 'swp_test_flutterwave_2950',
        provider: 'flutterwave_test',
        brand: 'MASTERCARD',
        last4: '2950',
        // Flutterwave's documented sandbox Mastercard.
        pan: '5531886652142950',
        expiry: '09/32',
        cvv: '564',
        type: 'Flutterwave test card',
        color: 'from-[#f5a524] via-[#ff8a3d] to-[#e0293c]',
    },
]

const sql = neon(process.env.DATABASE_URL)

async function main() {
    const users = await sql`SELECT id, name, email, wallet_balance::text AS wallet_balance
                              FROM users WHERE LOWER(email) = ${EMAIL.toLowerCase()} LIMIT 1`
    const user = users[0]
    if (!user) {
        console.error(`No user found for ${EMAIL}. Seed the account first.`)
        process.exit(1)
    }

    console.log(`Seeding test cards for ${user.name} <${user.email}> (id ${user.id})`)

    // Top the wallet up once, through a single statement that moves the balance
    // and writes its ledger row together - so the two can never disagree. The
    // fixed tx id makes a re-run a no-op rather than a second credit.
    const topUpTxId = `seed_topup_${user.id}`
    const credited = await sql`
    WITH moved AS (
      UPDATE users
         SET wallet_balance = wallet_balance + ${WALLET_TOP_UP}::numeric
       WHERE id = ${user.id}
         AND NOT EXISTS (SELECT 1 FROM transactions WHERE tx_id = ${topUpTxId})
       RETURNING id, wallet_balance
    )
    INSERT INTO transactions
      (tx_id, user_id, amount, currency, usdc_amount_debited, merchant, status, type,
       channel, category, metadata, balance_after)
    SELECT ${topUpTxId}, moved.id, ${WALLET_TOP_UP}::numeric, 'USD', 0,
           'Sandbox test float', 'SUCCESS', 'CREDIT', 'TRANSFER', 'Admin Override',
           ${JSON.stringify({ seeded: true, reason: 'Test float for sandbox card testing' })}::jsonb,
           moved.wallet_balance
      FROM moved
    ON CONFLICT (tx_id) DO NOTHING
    RETURNING balance_after::text AS balance_after`

    if (credited[0]) {
        console.log(`  Wallet credited ${WALLET_TOP_UP} -> balance ${credited[0].balance_after}`)
    } else {
        console.log(`  Wallet already funded (balance ${user.wallet_balance}); skipped`)
    }

    for (const card of TEST_CARDS) {
        const rows = await sql`
      INSERT INTO cards
        (user_id, card_id, flutterwave_card_id, provider, brand, masked_pan, last_4,
         card_holder, billing_name, expiry_date, type, color, currency, status,
         card_spending_limit, total_spent_by_card, spending_limit, balance)
      VALUES (${user.id}, ${card.cardId}, NULL, ${card.provider}, ${card.brand},
              ${`**** **** **** ${card.last4}`}, ${card.last4},
              ${user.name}, ${user.name}, ${card.expiry}, ${card.type}, ${card.color},
              'USD', 'ACTIVE', ${CARD_LIMIT}::numeric, 0.00, ${CARD_LIMIT}::numeric, 0.00)
      ON CONFLICT (card_id) DO UPDATE
        SET status = 'ACTIVE',
            card_spending_limit = GREATEST(cards.card_spending_limit, ${CARD_LIMIT}::numeric),
            spending_limit = GREATEST(cards.spending_limit, ${CARD_LIMIT}::numeric),
            expiry_date = EXCLUDED.expiry_date,
            type = EXCLUDED.type,
            color = EXCLUDED.color
      RETURNING id, last_4, card_spending_limit::text AS limit`

        const row = rows[0]
        console.log(
            `  ${card.type}: •••• ${row.last_4}  limit ${row.limit}  (full test PAN ${card.pan}, exp ${card.expiry}, cvv ${card.cvv})`
        )
    }

    console.log('\nDone. Both cards appear in the user dashboard and in the admin card lifecycle.')
    console.log('At /checkout, pick the card - it fills the last 4, which is what the match runs on.')
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
