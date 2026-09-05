import React from 'react'

/**
 * Landing-page illustrations.
 *
 * These replace the stock crypto-trading artwork the template shipped with:
 * that imagery was green/orange (clashing with the violet brand) and showed
 * BTC/ETH price charts rather than the wallet-and-cards product this actually
 * is. Drawing them as SVG keeps every colour on-brand, stays crisp at any
 * size, and ships no extra bytes over the wire beyond the markup.
 *
 * The figures shown are illustrative product chrome, not real account data.
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

/* ------------------------------------------------------------------ hero */

/** Phone showing the wallet, with a Swippable card floating in front. */
export function WalletPhoneIllustration({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 560 560" className={className} role="img" aria-label="Swippable wallet and virtual card">
            <defs>
                <linearGradient id="hero-card" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#622fcf" />
                    <stop offset="55%" stopColor="#824fed" />
                    <stop offset="100%" stopColor={TEAL} />
                </linearGradient>
                <linearGradient id="hero-glow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={VIOLET} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={VIOLET} stopOpacity="0" />
                </linearGradient>
                <linearGradient id="hero-bar" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor={VIOLET} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={VIOLET} />
                </linearGradient>
            </defs>

            {/* Ambient glow */}
            <circle cx="300" cy="230" r="215" fill="url(#hero-glow)" />

            {/* Phone body */}
            <rect x="168" y="30" width="264" height="470" rx="40" fill="#0e0a1c" stroke="#2c2350" strokeWidth="2" />
            <rect x="180" y="42" width="240" height="446" rx="32" fill={PANEL} />
            <rect x="266" y="56" width="68" height="8" rx="4" fill="#2c2350" />

            {/* Balance block */}
            <text x="204" y="112" fill={MUTED} fontSize="13" fontWeight="600">
                Wallet balance
            </text>
            <text x="204" y="150" fill="#ffffff" fontSize="34" fontWeight="800">
                $4,820.50
            </text>
            <rect x="204" y="166" width="86" height="22" rx="11" fill="rgba(18,184,143,0.16)" />
            <text x="216" y="181" fill={TEAL} fontSize="11" fontWeight="700">
                +12.4% mo
            </text>

            {/* Action chips */}
            <rect x="204" y="204" width="90" height="34" rx="17" fill={VIOLET} />
            <text x="224" y="226" fill="#ffffff" fontSize="12" fontWeight="700">
                Top up
            </text>
            <rect x="302" y="204" width="94" height="34" rx="17" fill={PANEL_SOFT} />
            <text x="322" y="226" fill="#ffffff" fontSize="12" fontWeight="700">
                Send
            </text>

            {/* Spend chart */}
            <text x="204" y="272" fill={MUTED} fontSize="12" fontWeight="600">
                This week
            </text>
            {[40, 62, 34, 78, 52, 88, 46].map((height, index) => (
                <rect
                    key={index}
                    x={204 + index * 28}
                    y={368 - height}
                    width="16"
                    height={height}
                    rx="8"
                    fill="url(#hero-bar)"
                />
            ))}

            {/* Recent rows */}
            {[
                { label: 'M-Pesa top up', amount: '+ $120.00', tone: TEAL },
                { label: 'Card • 4821', amount: '− $38.40', tone: '#ffffff' },
            ].map((row, index) => (
                <g key={row.label} transform={`translate(204 ${396 + index * 44})`}>
                    <rect width="192" height="34" rx="12" fill={PANEL_SOFT} />
                    <circle cx="20" cy="17" r="9" fill={index === 0 ? 'rgba(18,184,143,0.22)' : 'rgba(112,66,244,0.24)'} />
                    <text x="38" y="21" fill="#d9d5ea" fontSize="11" fontWeight="600">
                        {row.label}
                    </text>
                    <text x="182" y="21" textAnchor="end" fill={row.tone} fontSize="11" fontWeight="700">
                        {row.amount}
                    </text>
                </g>
            ))}

            {/* Floating card */}
            <g transform="translate(36 322) rotate(-8)">
                <rect width="252" height="159" rx="18" fill="url(#hero-card)" />
                <rect width="252" height="159" rx="18" fill="none" stroke="rgba(255,255,255,0.18)" />
                <text x="22" y="38" fill="#ffffff" fontSize="14" fontWeight="700" letterSpacing="1">
                    Swippable
                </text>
                <rect x="22" y="56" width="34" height="26" rx="5" fill="#e8c77a" />
                <text
                    x="22"
                    y="112"
                    fill="#ffffff"
                    fontSize="16"
                    fontWeight="600"
                    letterSpacing="2.5"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                    •••• •••• •••• 4821
                </text>
                <text x="22" y="138" fill="rgba(255,255,255,0.85)" fontSize="10" fontWeight="700" letterSpacing="1">
                    VIRTUAL • USD
                </text>
                <circle cx="206" cy="130" r="13" fill="#eb001b" />
                <circle cx="224" cy="130" r="13" fill="#f79e1b" fillOpacity="0.9" />
            </g>
        </svg>
    )
}

/* ------------------------------------------------------------------ work */

/** Wallet summary with a short activity list. */
export function WalletActivityIllustration({ className }: { className?: string }) {
    const rows = [
        { label: 'M-Pesa deposit', meta: 'Confirmed', amount: '+ $250.00', tone: TEAL },
        { label: 'Virtual card • 4821', meta: 'Groceries', amount: '− $42.15', tone: '#ffffff' },
        { label: 'Card funding', meta: 'Allocation', amount: '− $200.00', tone: '#ffffff' },
        { label: 'USDC deposit', meta: 'Base network', amount: '+ $500.00', tone: TEAL },
    ]

    return (
        <svg viewBox="0 0 520 400" className={className} role="img" aria-label="Wallet activity">
            <defs>
                <linearGradient id="work-glow" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={VIOLET} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={TEAL} stopOpacity="0.12" />
                </linearGradient>
            </defs>

            <rect x="26" y="18" width="468" height="364" rx="26" fill="url(#work-glow)" />
            <Panel x="46" y="34" width="428" height="332" />

            <text x="76" y="80" fill={MUTED} fontSize="13" fontWeight="600">
                Shared wallet
            </text>
            <text x="76" y="118" fill="#ffffff" fontSize="32" fontWeight="800">
                $1,284.60
            </text>

            <rect x="330" y="62" width="112" height="60" rx="14" fill={PANEL_SOFT} />
            <text x="346" y="86" fill={MUTED} fontSize="10" fontWeight="700">
                ON CARDS
            </text>
            <text x="346" y="108" fill={VIOLET_SOFT} fontSize="16" fontWeight="800">
                $640.00
            </text>

            {rows.map((row, index) => (
                <g key={row.label} transform={`translate(76 ${150 + index * 52})`}>
                    <rect width="366" height="42" rx="13" fill={PANEL_SOFT} />
                    <circle cx="26" cy="21" r="12" fill={index % 2 === 0 ? 'rgba(18,184,143,0.2)' : 'rgba(112,66,244,0.22)'} />
                    <text x="50" y="18" fill="#ffffff" fontSize="12" fontWeight="700">
                        {row.label}
                    </text>
                    <text x="50" y="32" fill={MUTED} fontSize="10">
                        {row.meta}
                    </text>
                    <text x="348" y="26" textAnchor="end" fill={row.tone} fontSize="12" fontWeight="800">
                        {row.amount}
                    </text>
                </g>
            ))}
        </svg>
    )
}

/* ------------------------------------------------------------- portfolio */

/** Compact dashboard preview: stat tiles, spend chart and a card. */
export function DashboardPreviewIllustration({ className }: { className?: string }) {
    const tiles = [
        { label: 'Balance', value: '$4,820', tone: VIOLET_SOFT },
        { label: 'In', value: '$1,940', tone: TEAL },
        { label: 'Out', value: '$862', tone: '#f7b746' },
    ]

    return (
        <svg viewBox="0 0 560 460" className={className} role="img" aria-label="Swippable dashboard preview">
            <defs>
                <linearGradient id="pf-card" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#622fcf" />
                    <stop offset="100%" stopColor="#824fed" />
                </linearGradient>
                <linearGradient id="pf-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={VIOLET} stopOpacity="0.45" />
                    <stop offset="100%" stopColor={VIOLET} stopOpacity="0" />
                </linearGradient>
            </defs>

            <Panel x="30" y="26" width="500" height="330" />

            {/* Stat tiles */}
            {tiles.map((tile, index) => (
                <g key={tile.label} transform={`translate(${58 + index * 152} 58)`}>
                    <rect width="136" height="74" rx="16" fill={PANEL_SOFT} />
                    <text x="18" y="28" fill={MUTED} fontSize="10" fontWeight="700">
                        {tile.label.toUpperCase()}
                    </text>
                    <text x="18" y="54" fill={tile.tone} fontSize="20" fontWeight="800">
                        {tile.value}
                    </text>
                </g>
            ))}

            {/* Area chart */}
            <rect x="58" y="152" width="440" height="176" rx="18" fill={PANEL_SOFT} />
            <path
                d="M84 288 L140 262 L196 272 L252 226 L308 240 L364 196 L420 210 L472 172 L472 306 L84 306 Z"
                fill="url(#pf-area)"
            />
            <path
                d="M84 288 L140 262 L196 272 L252 226 L308 240 L364 196 L420 210 L472 172"
                fill="none"
                stroke={VIOLET}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="472" cy="172" r="6" fill={VIOLET} stroke="#ffffff" strokeWidth="2" />

            {/* Card */}
            <g transform="translate(300 300)">
                <rect width="228" height="134" rx="16" fill="url(#pf-card)" />
                <text x="20" y="34" fill="#ffffff" fontSize="12" fontWeight="700" letterSpacing="1">
                    Swippable
                </text>
                <rect x="20" y="48" width="30" height="23" rx="5" fill="#e8c77a" />
                <text
                    x="20"
                    y="98"
                    fill="#ffffff"
                    fontSize="14"
                    fontWeight="600"
                    letterSpacing="2"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                    •••• •••• 4821
                </text>
                <text x="20" y="118" fill="rgba(255,255,255,0.8)" fontSize="9" fontWeight="700">
                    VIRTUAL • ACTIVE
                </text>
                <circle cx="186" cy="110" r="11" fill="#eb001b" />
                <circle cx="202" cy="110" r="11" fill="#f79e1b" fillOpacity="0.9" />
            </g>
        </svg>
    )
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
