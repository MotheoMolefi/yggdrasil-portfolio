import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Yggdrasil Portfolio',
  description: 'An interactive 3D portfolio featuring the World Tree',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="w-screen h-screen overflow-hidden">{children}</body>
    </html>
  )
}
