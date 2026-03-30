'use client'

import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { WELCOME_PARTICLE_CURSOR_ACCENT_HEX } from '../lib/codrops/particleCursorColor'
import LoadingParticles, { PARTICLE_LINES_WELCOME } from './LoadingParticles'

interface WelcomeScreenProps {
  onEnter: () => void
}

const CONTROLS = [
  { keys: ['W', 'A', 'S', 'D'], label: 'Fly through the world' },
  { keys: ['Mouse'], label: 'Look around' },
  { keys: ['Scroll'], label: 'Guided tour' },
  { keys: ['R'], label: 'Summon Ratatoskr' },
  { keys: ['G'], label: 'Toggle guided / free roam' },
  { keys: ['T'], label: 'Cycle realms' },
  { keys: ['M'], label: 'Toggle music' },
  { keys: ['Esc'], label: 'Close panels' },
]

// One frame delay so the 3D scene paints first — avoids flash when transitioning from loading screen
function usePaintReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setReady(true))
    })
    return () => cancelAnimationFrame(id)
  }, [])
  return ready
}

// Defer Canvas mount until container is in DOM so R3F connect() doesn't see null
function useCanvasReady(visible: boolean) {
  const [canvasReady, setCanvasReady] = useState(false)
  useEffect(() => {
    if (!visible) {
      setCanvasReady(false)
      return
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setCanvasReady(true))
    })
    return () => cancelAnimationFrame(id)
  }, [visible])
  return canvasReady
}

export default function WelcomeScreen({ onEnter }: WelcomeScreenProps) {
  const [phase, setPhase]     = useState<'intro' | 'controls'>('intro')
  const [exiting, setExiting] = useState(false)
  const [visible, setVisible] = useState(true)
  const paintReady = usePaintReady()
  const showIntroParticles = visible && phase === 'intro'
  const canvasReady = useCanvasReady(showIntroParticles)

  // Stable refs so event handlers always see latest values
  const phaseRef   = useRef(phase)
  const exitingRef = useRef(exiting)
  useEffect(() => { phaseRef.current = phase },   [phase])
  useEffect(() => { exitingRef.current = exiting }, [exiting])

  const goToControls = () => {
    if (phaseRef.current !== 'intro') return
    setPhase('controls')
  }

  const enter = () => {
    if (exitingRef.current) return
    setExiting(true)
    setTimeout(() => {
      setVisible(false)
      onEnter()
    }, 800)
  }

  // Keyboard handler — any key advances each phase
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return
      if (phaseRef.current === 'intro') goToControls()
      else enter()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ opacity: exiting ? 0 : 1, transition: 'opacity 0.8s ease' }}
    >
      {/* Dark blue transparent overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(18,36,84,0.28) 0%, rgba(10,24,64,0.56) 40%, rgba(4,10,32,0.84) 100%)',
        }}
      />

      {/* Particles only on intro — omit entire layer on controls (z-[1] was painting above z-auto UI) */}
      {showIntroParticles && canvasReady && (
        <div className="absolute inset-0 z-[1] pointer-events-none" aria-hidden>
          <Canvas
            camera={{ position: [0, 0, 800], fov: 60, near: 0.1, far: 10000 }}
            gl={{
              alpha: true,
              antialias: true,
              powerPreference: 'high-performance',
              stencil: false,
              depth: false,
            }}
            frameloop="always"
            style={{ display: 'block', width: '100%', height: '100%' }}
          >
            <LoadingParticles
              transparentBackground
              lines={PARTICLE_LINES_WELCOME}
              textScale={0.50}
              titleOffsetYPx={0}
              cursorRepelHex={WELCOME_PARTICLE_CURSOR_ACCENT_HEX}
            />
          </Canvas>
        </div>
      )}

      {/* ── Phase 1: Intro ─────────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 z-[2] flex flex-col items-center justify-center pointer-events-none select-none"
        style={{
          opacity:   phase === 'intro' && paintReady ? 1 : 0,
          transform: phase === 'intro' ? 'translateY(0px)' : 'translateY(-24px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}
      >
        {/* Same horizontal center as particle title (viewport center); offset down so stack reads as one unit */}
        <div
          className="flex w-full max-w-[min(92vw,28rem)] flex-col items-center justify-center px-4"
          style={{
            transform: 'translateY(clamp(4.5rem, 13vh, 7rem))',
          }}
        >
          <p
            className="m-0 w-full text-center"
            style={{
              fontFamily: "'Norse', system-ui, sans-serif",
              fontWeight: 'bold',
              fontSize: 'clamp(1.2rem, 3.65vw, 1.65rem)',
              color: 'rgba(248, 252, 255, 0.9)',
              letterSpacing: '0.12em',
            }}
          >
            A 3D interactive portfolio site
          </p>
        </div>
        {/* Click-to-continue cue */}
        <div
          className="absolute bottom-10 flex flex-col items-center gap-2"
          style={{ animation: 'pulseOpacity 2.4s ease-in-out infinite' }}
        >
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(180,200,255,0.35)' }}>
            click anywhere to continue
          </p>
          {/* Chevron */}
          <svg width="14" height="9" viewBox="0 0 14 9" fill="none">
            <path d="M1 1L7 7L13 1" stroke="rgba(160,190,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Invisible click-catcher for phase 1 */}
      {phase === 'intro' && (
        <div className="absolute inset-0 z-[3] cursor-pointer" onClick={goToControls} />
      )}

      {/* ── Phase 2: Controls ──────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 z-[2] flex flex-col items-center justify-center"
        style={{
          opacity:   phase === 'controls' ? 1 : 0,
          transform: phase === 'controls' ? 'translateY(0px)' : 'translateY(24px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
          pointerEvents: phase === 'controls' ? 'auto' : 'none',
        }}
      >
        <div className="flex flex-col items-center gap-7 px-6 max-w-md w-full text-center">

          <h2
            className="text-lg font-medium tracking-widest uppercase"
            style={{ color: 'rgba(200,225,255,0.7)', letterSpacing: '0.25em' }}
          >
            How to explore
          </h2>

          {/* Divider */}
          <div
            className="w-20 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(130,180,255,0.45), transparent)' }}
          />

          {/* Controls grid */}
          <div className="w-full flex flex-col gap-2">
            {CONTROLS.map(({ keys, label }) => (
              <div key={label} className="flex items-center justify-between gap-4 px-2">
                <span className="text-xs" style={{ color: 'rgba(190,215,255,0.45)' }}>
                  {label}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {keys.map((k) => (
                    <span
                      key={k}
                      className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold"
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        color: 'rgba(215,230,255,0.85)',
                        border: '1px solid rgba(255,255,255,0.11)',
                        lineHeight: '1.6',
                      }}
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div
            className="w-20 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(130,180,255,0.45), transparent)' }}
          />

          {/* Enter button */}
          <button
            onClick={enter}
            className="px-10 py-3 rounded-full text-sm font-medium uppercase"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(215,235,255,0.9)',
              border: '1px solid rgba(255,255,255,0.18)',
              letterSpacing: '0.2em',
              cursor: 'pointer',
              transition: 'background 0.25s, border-color 0.25s, box-shadow 0.25s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background   = 'rgba(255,255,255,0.13)'
              e.currentTarget.style.borderColor  = 'rgba(255,255,255,0.38)'
              e.currentTarget.style.boxShadow    = '0 0 22px rgba(120,180,255,0.22)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background   = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.borderColor  = 'rgba(255,255,255,0.18)'
              e.currentTarget.style.boxShadow    = 'none'
            }}
          >
            Enter
          </button>

          <p className="text-[10px] -mt-3" style={{ color: 'rgba(180,200,255,0.28)' }}>
            press any key to begin
          </p>
        </div>
      </div>

      {/* Pulse keyframe injected inline */}
      <style>{`
        @keyframes pulseOpacity {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
      `}</style>
    </div>
  )
}
