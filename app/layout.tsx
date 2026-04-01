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
        {/*
          Do not link-preload cubemap PNGs: drei's texture path often does not match
          the preload credentials mode → DevTools spam + wasted duplicate fetches.
          Same for .glb / JSON — let Three/R3F own a single load path per URL.
        */}
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
      <body className="w-screen h-screen overflow-hidden bg-black">{children}</body>
    </html>
  )
}
