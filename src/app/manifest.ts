import type { MetadataRoute } from 'next'

/**
 * Home-screen install profile. `start_url` points at the dashboard rather than
 * the marketing site: someone who installed Swippable wants their wallet, not
 * the pitch. Signed-out visitors are still routed to sign-in from there.
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Swippable — wallet and virtual cards',
        short_name: 'Swippable',
        description:
            'One wallet, unlimited virtual cards. Top up with M-Pesa or USDC and spend from a single balance.',
        start_url: '/dashboard',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f5f5f7',
        theme_color: '#6330cf',
        categories: ['finance'],
        icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
            { name: 'Wallet', short_name: 'Wallet', url: '/dashboard/wallet' },
            { name: 'Cards', short_name: 'Cards', url: '/dashboard/cards' },
            { name: 'Payments', short_name: 'Payments', url: '/dashboard/transactions' },
        ],
    }
}
