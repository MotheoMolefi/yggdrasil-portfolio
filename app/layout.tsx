import type { Metadata } from 'next'
import './globals.css'
import { PRELOAD_SKYBOX_IMAGES } from './lib/criticalPreload'

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
        {PRELOAD_SKYBOX_IMAGES.map((href) => (
          <link key={href} rel="preload" href={href} as="image" />
        ))}
        {/*
          Do NOT link-preload .glb / norse JSON as fetch. Chrome pairs that cache entry
          with a different credential partition than GLTFLoader/FileLoader (XHR), which
          triggers "credentials mode does not match", unused preload spam, and in
          Incognito can surface ERR_CACHE_WRITE_FAILURE — breaking both preload and load.
          Let Three loaders own those URLs as the single fetch path.
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
