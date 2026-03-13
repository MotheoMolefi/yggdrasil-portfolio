'use client'

import { useState, useEffect } from 'react'

interface WelcomeScreenProps {
  onEnter: () => void
}

export default function WelcomeScreen({ onEnter }: WelcomeScreenProps) {
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        handleEnter()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const handleEnter = () => {
    if (fading) return
    setFading(true)
    setTimeout(() => {
      setVisible(false)
      onEnter()
    }, 800)
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #0a0a1a 0%, #050510 50%, #0a0a1a 100%)',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.8s ease-out',
      }}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              background: 'rgba(212, 175, 55, 0.6)',
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Content container */}
      <div
        className="relative text-center px-8"
        style={{
          transform: fading ? 'scale(0.95)' : 'scale(1)',
          transition: 'transform 0.8s ease-out',
        }}
      >
        {/* Decorative rune border top */}
        <div className="flex justify-center gap-4 mb-8 opacity-50">
          {['ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ'].map((rune, i) => (
            <span
              key={i}
              className="text-2xl text-amber-400"
              style={{
                animation: 'pulse 2s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            >
              {rune}
            </span>
          ))}
        </div>

        {/* Main title */}
        <h1
          className="text-6xl md:text-8xl font-bold mb-4 tracking-wider"
          style={{
            background: 'linear-gradient(180deg, #ffd700 0%, #d4af37 50%, #b8860b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 0 60px rgba(212, 175, 55, 0.5)',
            fontFamily: 'Cinzel, Georgia, serif',
          }}
        >
          YGGDRASIL
        </h1>

        {/* Subtitle */}
        <p
          className="text-lg md:text-xl mb-12 tracking-[0.3em] uppercase"
          style={{
            color: 'rgba(212, 175, 55, 0.8)',
            textShadow: '0 0 20px rgba(212, 175, 55, 0.3)',
          }}
        >
          The World Tree
        </p>

        {/* Enter button */}
        <button
          onClick={handleEnter}
          className="group relative px-12 py-4 text-lg font-semibold tracking-widest uppercase transition-all duration-300 hover:scale-105"
          style={{
            background: 'transparent',
            border: '2px solid rgba(212, 175, 55, 0.6)',
            color: '#d4af37',
            borderRadius: '4px',
          }}
        >
          <span
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.2), transparent)',
            }}
          />
          <span className="relative">Enter Realm</span>
        </button>

        {/* Keyboard hint */}
        <p
          className="mt-6 text-sm"
          style={{ color: 'rgba(212, 175, 55, 0.4)' }}
        >
          Press <kbd className="px-2 py-1 mx-1 rounded bg-amber-900/30 text-amber-400">Enter</kbd> to begin
        </p>

        {/* Decorative rune border bottom */}
        <div className="flex justify-center gap-4 mt-8 opacity-50">
          {['ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ'].map((rune, i) => (
            <span
              key={i}
              className="text-2xl text-amber-400"
              style={{
                animation: 'pulse 2s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            >
              {rune}
            </span>
          ))}
        </div>
      </div>

      {/* CSS animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: translateY(-20px) scale(1.2);
            opacity: 1;
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  )
}
