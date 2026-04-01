import type { Metadata } from 'next'
import './globals.css'
import {
  PRELOAD_SCENE_GLBS,
  PRELOAD_SKYBOX_IMAGES,
  PRELOAD_WELCOME_FONT_JSON,
} from './lib/criticalPreload'

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
        {/* Same-origin: omit crossOrigin so preload matches GLTFLoader / fetch (avoids DevTools credential-mode warnings). */}
        {PRELOAD_SCENE_GLBS.map((href) => (
          <link key={href} rel="preload" href={href} as="fetch" />
        ))}
        <link rel="preload" href={PRELOAD_WELCOME_FONT_JSON} as="fetch" />
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
