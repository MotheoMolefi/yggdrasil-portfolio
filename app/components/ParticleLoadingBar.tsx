'use client'

const FRAME_BG =
  'linear-gradient(135deg, rgba(10,12,20,0.95) 0%, rgba(20,23,33,0.98) 40%, rgba(7,9,15,1) 100%)'
const FRAME_BORDER = 'rgba(158, 142, 110, 0.9)' // warm stone edge
const FILL_GRADIENT =
  'linear-gradient(90deg, rgba(80,180,255,0.1) 0%, rgba(120,210,255,0.65) 35%, rgba(180,240,255,0.9) 55%, rgba(80,180,255,0.65) 100%)'
const FILL_GLOW = '0 0 22px rgba(120,210,255,0.7)'

export default function ParticleLoadingBar({ progress }: { progress: number }) {
  const clamped = Math.min(100, Math.max(0, progress))

  return (
    <div
      className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
      aria-hidden
    >
      <div
        className="w-[260px] h-[14px] rounded-full relative overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.8)]"
        style={{
          backgroundImage: FRAME_BG,
          border: '1px solid rgba(0,0,0,0.7)',
          boxShadow:
            '0 0 0 1px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(255,255,255,0.03), 0 14px 28px rgba(0,0,0,0.55)',
        }}
      >
        {/* Norse \"cracked stone\" feel via subtle inner bands */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 5px)',
            mixBlendMode: 'screen',
          }}
        />
        <div
          className="absolute left-0 top-0 h-full rounded-full origin-left transition-all duration-400 ease-out"
          style={{
            width: `${clamped}%`,
            backgroundImage: FILL_GRADIENT,
            boxShadow: clamped > 0 ? FILL_GLOW : 'none',
          }}
        />
      </div>
      <div className="text-[10px] tracking-[0.22em] uppercase text-[rgba(215,208,180,0.7)]">
        Connecting the Nine Realms…
      </div>
    </div>
  )
}
