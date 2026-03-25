'use client'

const FRAME_BG_DARK =
  'linear-gradient(135deg, rgba(10,12,20,0.95) 0%, rgba(20,23,33,0.98) 40%, rgba(7,9,15,1) 100%)'
const FRAME_BG_LIGHT =
  'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(245,243,238,0.98) 50%, rgba(235,232,226,1) 100%)'
const FILL_GRADIENT_DARK =
  'linear-gradient(90deg, rgba(80,180,255,0.1) 0%, rgba(120,210,255,0.65) 35%, rgba(180,240,255,0.9) 55%, rgba(80,180,255,0.65) 100%)'
const FILL_GRADIENT_LIGHT =
  'linear-gradient(90deg, rgba(99,229,255,0.2) 0%, rgba(80,160,220,0.55) 40%, rgba(60,130,200,0.75) 55%, rgba(99,229,255,0.35) 100%)'
const FILL_GLOW_DARK = '0 0 22px rgba(120,210,255,0.7)'
const FILL_GLOW_LIGHT = '0 0 18px rgba(80,150,210,0.45)'

export default function ParticleLoadingBar({
  progress,
  variant = 'dark',
}: {
  progress: number
  variant?: 'dark' | 'light'
}) {
  const clamped = Math.min(100, Math.max(0, progress))
  const light = variant === 'light'

  return (
    <div
      className="pointer-events-none flex w-full flex-col items-center gap-3"
      aria-hidden
    >
      <div
        className="w-[260px] h-[14px] rounded-full relative overflow-hidden"
        style={{
          backgroundImage: light ? FRAME_BG_LIGHT : FRAME_BG_DARK,
          border: light ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(0,0,0,0.7)',
          boxShadow: light
            ? '0 0 0 1px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(255,255,255,0.6), 0 10px 24px rgba(0,0,0,0.08)'
            : '0 0 0 1px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(255,255,255,0.03), 0 14px 28px rgba(0,0,0,0.55)',
        }}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: light
              ? 'repeating-linear-gradient(135deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 2px, transparent 2px, transparent 5px)'
              : 'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 5px)',
            mixBlendMode: light ? 'multiply' : 'screen',
          }}
        />
        <div
          className="absolute left-0 top-0 h-full rounded-full origin-left transition-all duration-400 ease-out"
          style={{
            width: `${clamped}%`,
            backgroundImage: light ? FILL_GRADIENT_LIGHT : FILL_GRADIENT_DARK,
            boxShadow: clamped > 0 ? (light ? FILL_GLOW_LIGHT : FILL_GLOW_DARK) : 'none',
          }}
        />
      </div>
      <div
        className="text-[10px] tracking-[0.22em] uppercase"
        style={{
          color: light ? 'rgba(55, 48, 38, 0.65)' : 'rgba(215,208,180,0.7)',
        }}
      >
        Connecting the Nine Realms…
      </div>
    </div>
  )
}
