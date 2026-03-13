'use client'

import { useEffect, useState } from 'react'

interface WelcomeScreenProps {
  onEnter: () => void
}

export default function WelcomeScreen({ onEnter }: WelcomeScreenProps) {
  const [visible, setVisible] = useState(true)
  const [animateOut, setAnimateOut] = useState(false)

  const handleEnter = () => {
    setAnimateOut(true)
    setTimeout(() => {
      setVisible(false)
      onEnter()
    }, 1000)
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !animateOut) {
        handleEnter()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [animateOut])

  if (!visible) return null

  return (
    <>
      <style jsx>{`
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes fadeOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes glowPulse {
          0%, 100% { text-shadow: 0 0 20px rgba(255, 215, 0, 0.5), 0 0 40px rgba(255, 215, 0, 0.3); }
          50% { text-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 215, 0, 0.5); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes buttonGlow {
          0%, 100% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.3); }
          50% { box-shadow: 0 0 25px rgba(255, 215, 0, 0.6), 0 0 35px rgba(255, 215, 0, 0.2); }
        }
        .rune {
          animation: float 3s ease-in-out infinite;
        }
        .rune:nth-child(2) { animation-delay: 0.2s; }
        .rune:nth-child(3) { animation-delay: 0.4s; }
        .rune:nth-child(4) { animation-delay: 0.6s; }
        .rune:nth-child(5) { animation-delay: 0.8s; }
        .rune:nth-child(6) { animation-delay: 1.0s; }
        .rune:nth-child(7) { animation-delay: 1.2s; }
        .rune:nth-child(8) { animation-delay: 1.4s; }
        .rune:nth-child(9) { animation-delay: 1.6s; }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black"
        style={{
          animation: animateOut ? 'fadeOut 1s ease-out forwards' : 'fadeIn 1.5s ease-out',
          background: 'radial-gradient(circle at center, rgba(10, 10, 30, 0.95) 0%, rgba(0, 0, 0, 1) 100%)',
        }}
      >
        <div className="text-center px-4">
          <div className="mb-8 flex justify-center gap-2 text-6xl md:text-8xl tracking-wider">
            {['Y', 'G', 'G', 'D', 'R', 'A', 'S', 'I', 'L'].map((char, i) => (
              <span
                key={i}
                className="rune font-bold text-amber-100"
                style={{
                  animation: `float 3s ease-in-out infinite ${i * 0.1}s, glowPulse 2s ease-in-out infinite ${i * 0.1}s`,
                }}
              >
                {char}
              </span>
            ))}
          </div>

          <p className="text-lg md:text-xl text-amber-200/80 mb-12 max-w-md mx-auto tracking-wide">
            The World Tree awaits your journey through the realms of creation
          </p>

          <button
            onClick={handleEnter}
            className="px-8 py-3 text-lg bg-transparent border border-amber-400 text-amber-100 rounded-md 
                       hover:bg-amber-500/10 transition-all duration-300 relative overflow-hidden group"
            style={{ animation: 'buttonGlow 2s ease-in-out infinite' }}
          >
            <span className="relative z-10 tracking-wider">ENTER THE REALMS</span>
            <div className="absolute inset-0 bg-amber-500/10 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
          </button>

          <p className="mt-8 text-amber-200/60 text-sm">Press Enter to continue</p>
        </div>
      </div>
    </>
  )
}
