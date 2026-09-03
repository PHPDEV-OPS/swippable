import { DM_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import Aoscompo from '@/utils/aos'
import ConditionalLayout from '@/components/Layout/ConditionalLayout'

const font = DM_Sans({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={`${font.className}`}>
        <Providers>
          <Aoscompo>
            <ConditionalLayout>
              {children}
            </ConditionalLayout>
          </Aoscompo>
        </Providers>
      </body>
    </html>
  )
}
