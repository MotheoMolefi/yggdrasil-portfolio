import dynamic from 'next/dynamic'

// Dynamic import with no SSR for Three.js components
const Scene = dynamic(() => import('./components/Scene'), {
  ssr: false,
})

export default function Home() {
  return (
    <main className="w-full h-full">
      <Scene />
    </main>
  )
}
