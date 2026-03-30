import * as THREE from 'three'

/**
 * #63E5FF — default cursor repel (GPGPU / LoadingParticles when no custom hex).
 */
export const PARTICLE_CURSOR_ACCENT_HEX = '#63E5FF' as const

export const PARTICLE_CURSOR_ACCENT = new THREE.Color(PARTICLE_CURSOR_ACCENT_HEX)

/** #B1F2FF — welcome / Yggdrasil title screen cursor repel only */
export const WELCOME_PARTICLE_CURSOR_ACCENT_HEX = '#B1F2FF' as const
