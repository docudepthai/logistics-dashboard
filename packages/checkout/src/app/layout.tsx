import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Patron - Odeme',
  description: 'Patron Lojistik Bot Premium Uyelik',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body className={`${inter.className} bg-gradient-radial min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
