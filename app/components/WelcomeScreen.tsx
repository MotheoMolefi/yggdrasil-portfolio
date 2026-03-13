'use client'

import { useState, useEffect } from 'react'

interface WelcomeScreenProps {
  onEnter: () => void
}

export default function WelcomeScreen({ onEnter }: WelcomeScreenProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [textVisible, setTextVisible] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setIsVisible(true), 100)
    const textTimer = setTimeout(() => setTextVisible(true), 600)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(textTimer)
    }
  }, [])

  const handleEnter = () => {
    setIsVisible(false)
    setTimeout(onEnter, 400)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at center, #0a0a1a 0%, #050510 100%)',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.5s ease',
      }}
    >
      <div
        className="flex flex-col items-center gap-8"
        style={{
          opacity: textVisible ? 1 : 0,
          transform: textVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <h1
            className="text-6xl md:text-8xl font-bold tracking-wider"
            style={{
              fontFamily: 'serif',
              background: 'linear-gradient(180deg, #ffd700 0%, #b8860b 50%, #8b6914 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 0 60px rgba(255, 215, 0, 0.4)',
              letterSpacing: '0.15em',
            }}
          >
            YGGDRASIL
          </h1>
          <p
            className="text-lg md:text-xl tracking-widest uppercase"
            style={{
              color: 'rgba(255, 215, 0, 0.6)',
              letterSpacing: '0.3em',
            }}
          >
            The World Tree
          </p>
        </div>

        <div
          className="h-px w-64"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.5), transparent)',
          }}
        />

        <p
          className="text-center max-w-md px-6"
          style={{
            color: 'rgba(200, 200, 220, 0.7)',
            lineHeight: '1.8',
            fontSize: '0.95rem',
          }}
        >
          Welcome to an interactive 3D portfolio inspired by Norse mythology.
          Explore the branches of the World Tree to discover projects and stories.
        </p>

        <button
          onClick={handleEnter}
          className="mt-4 px-8 py-3 rounded-lg text-sm uppercase tracking-widest font-semibold transition-all duration-300 hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(139, 105, 20, 0.3) 100%)',
            border: '1px solid rgba(255, 215, 0, 0.4)',
            color: '#ffd700',
            boxShadow: '0 0 30px rgba(255, 215, 0, 0.15)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 0 50px rgba(255, 215, 0, 0.3)'
            e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.7)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.15)'
            e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.4)'
          }}
        >
          Enter the Realm
        </button>

        <div className="flex flex-col items-center gap-2 mt-6">
          <div
            className="flex gap-4 text-xs uppercase tracking-wider"
            style={{ color: 'rgba(200, 200, 220, 0.5)' }}
          >
            <span className="px-2 py-1 rounded" style={{ background: 'rgba(255, 255, 255, 0.1)' }}>G</span>
            <span>Toggle Camera Mode</span>
          </div>
          <div
            className="flex gap-4 text-xs uppercase tracking-wider"
            style={{ color: 'rgba(200, 200, 220, 0.5)' }}
          >
            <span className="px-2 py-1 rounded" style={{ background: 'rgba(255, 255, 255, 0.1)' }}>R</span>
            <span>Chat with Ratatoskr</span>
          </div>
          <div
            className="flex gap-4 text-xs uppercase tracking-wider"
            style={{ color: 'rgba(200, 200, 220, 0.5)' }}
          >
            <span className="px-2 py-1 rounded" style={{ background: 'rgba(255, 255, 255, 0.1)' }}>E</span>
            <span>Interact with Orbs</span>
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-8 text-xs uppercase tracking-widest"
        style={{ color: 'rgba(200, 200, 220, 0.4)' }}
      >
        A portfolio by Motheo Molefi
      </div>
    </div>
  )
}
