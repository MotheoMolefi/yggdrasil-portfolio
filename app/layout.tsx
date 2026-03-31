import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Yggdrasil Portfolio',
  description: 'An interactive 3D portfolio featuring the World Tree',
  icons: {
    icon: '/Yggdrasil_favicon.png?v=2',
    shortcut: '/Yggdrasil_favicon.png?v=2',
    apple: '/Yggdrasil_favicon.png?v=2',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/Norse.otf"
          as="font"
          type="font/otf"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Norsebold.otf"
          as="font"
          type="font/otf"
          crossOrigin="anonymous"
        />
      </head>
      <body className="w-screen h-screen overflow-hidden bg-[#050510]">{children}</body>
    </html>
  )
}
