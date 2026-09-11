import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs';
import { DM_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import Aoscompo from '@/utils/aos'
import ConditionalLayout from '@/components/Layout/ConditionalLayout'
import { Analytics } from '@vercel/analytics/next';

const font = DM_Sans({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Swippable',
    template: '%s · Swippable',
  },
  description:
    'One wallet, unlimited virtual cards. Top up with M-Pesa or USDC and spend from a single balance.',
  applicationName: 'Swippable',
  manifest: '/manifest.webmanifest',
  // Declaring `icons` at all suppresses Next's file-convention injection for
  // app/icon.svg, so listing only `apple` here silently dropped the browser tab
  // icon entirely - the route still served /icon.svg, but no <link rel="icon">
  // was ever emitted. Every rel we want has to be named explicitly.
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      // PNG fallback for the handful of contexts that ignore SVG favicons.
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/icon.svg',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Swippable',
    // Translucent lets the wallet gradient run under the status bar once the
    // app is installed to a home screen.
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    // Card numbers and balances should never turn into phone-number links.
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom stays available; capping it at 1 would fail WCAG 1.4.4.
  maximumScale: 5,
  // Lets the layout paint into the notch and home-indicator areas, which the
  // `*-safe` utilities then pad back out.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#080808' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={`${font.className}`}>
        <ClerkProvider>
          <Providers>
          <Aoscompo>
          <ConditionalLayout>
          {children}
          </ConditionalLayout>
          </Aoscompo>
          </Providers>
        </ClerkProvider>
        <Analytics />
      </body>
    </html>
  )
}
