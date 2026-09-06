import React from 'react'

/**
 * Landing-page illustrations.
 *
 * Drawn rather than captured, so every colour is on-brand and the figure stays
 * crisp at any size. The numbers shown are illustrative product chrome, not
 * real account data.
 */

const VIOLET = '#7042f4'
const VIOLET_DEEP = '#4a1fa8'
const VIOLET_SOFT = '#b9a4f7'
const TEAL = '#12b88f'
const PANEL = '#16112b'
const PANEL_SOFT = '#211a3d'
const MUTED = '#9d97b8'

/** Rounded panel used as the base of most of these compositions. */
function Panel(props: React.SVGProps<SVGRectElement>) {
    return <rect rx="18" fill={PANEL} {...props} />
}

/* --------------------------------------------------------------- upgrade */

/** Per-card spending limits, the feature this section describes. */
export function CardLimitsIllustration({ className }: { className?: string }) {
    const cards = [
        { name: 'Everyday • 4821', used: 0.62, limit: '$500', spent: '$310' },
        { name: 'Subscriptions • 7734', used: 0.34, limit: '$250', spent: '$85' },
        { name: 'Travel • 1902', used: 0.81, limit: '$800', spent: '$648' },
    ]

    return (
        <svg viewBox="0 0 520 420" className={className} role="img" aria-label="Per-card spending limits">
            <defs>
                <linearGradient id="up-glow" x1="1" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TEAL} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={VIOLET} stopOpacity="0.22" />
                </linearGradient>
                <linearGradient id="up-fill" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={VIOLET_DEEP} />
                    <stop offset="100%" stopColor={VIOLET} />
                </linearGradient>
            </defs>

            <rect x="20" y="20" width="480" height="380" rx="28" fill="url(#up-glow)" />
            <Panel x="40" y="38" width="440" height="344" />

            <text x="72" y="86" fill="#ffffff" fontSize="18" fontWeight="800">
                Spending limits
            </text>
            <text x="72" y="108" fill={MUTED} fontSize="12">
                Each card draws on the same wallet
            </text>

            {cards.map((card, index) => (
                <g key={card.name} transform={`translate(72 ${140 + index * 78})`}>
                    <text x="0" y="14" fill="#ffffff" fontSize="12" fontWeight="700">
                        {card.name}
                    </text>
                    <text x="376" y="14" textAnchor="end" fill={MUTED} fontSize="11" fontWeight="600">
                        {card.spent} / {card.limit}
                    </text>
                    <rect y="26" width="376" height="10" rx="5" fill={PANEL_SOFT} />
                    <rect y="26" width={376 * card.used} height="10" rx="5" fill="url(#up-fill)" />
                </g>
            ))}

            <g transform="translate(72 352)">
                <rect width="376" height="1" fill="rgba(255,255,255,0.08)" />
                <text x="0" y="22" fill={MUTED} fontSize="11" fontWeight="600">
                    Wallet available
                </text>
                <text x="376" y="22" textAnchor="end" fill={TEAL} fontSize="12" fontWeight="800">
                    $1,284.60
                </text>
            </g>
        </svg>
    )
}
