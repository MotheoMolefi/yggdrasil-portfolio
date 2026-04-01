'use client'

/**
 * LoadingParticles — Dreamy particle effect shaped as text (Norse Bold) or fallback sphere.
 * Uses FontLoader when /norse_font/Norsebold.json is available; falls back to sphere if missing.
 */

import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FontLoader, Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { ExtrudeGeometry, Shape } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import GPGPU from '@/app/lib/codrops/GPGPU'
import { PARTICLE_CURSOR_ACCENT } from '../lib/codrops/particleCursorColor'
import { getHollowGlyphSet, getLayoutCharInfos } from '@/app/lib/norseFontUtils'

const PARTICLE_GRID_SIZE = 280
const DISTANCE_IN_FRONT = 800
const TITLE_SCREEN_OFFSET_Y_PX = -5
/** Whole letter formation scales together (not per-particle point size) */
const MESH_BREATH_AMPLITUDE = 0.045
const MESH_BREATH_FREQ = 1.15
const GOLD = new THREE.Color(0.808, 0.647, 0.239)
const WHITE = new THREE.Color(0.95, 0.92, 0.85)
const COPPER = new THREE.Color(0.72, 0.45, 0.2)
const CYAN = new THREE.Color(0.4, 0.75, 0.9)
const PALETTE = { GOLD, WHITE, COPPER, CYAN }
/** Shader idles silver ↔ this white */
const PARTICLE_COLOR = new THREE.Color(1, 1, 1)

function makeSphereMesh(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(280, 64, 64)
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }))
  mesh.visible = false
  return mesh
}

function makeTextMesh(
  font: Font,
  lines: readonly string[],
  fontSize: number,
  targetScale: number,
  lineGap: number
): THREE.Mesh {
  const charInfos = getLayoutCharInfos(font, lines, fontSize, lineGap)
  const layoutMin = new THREE.Vector3(Infinity, Infinity, Infinity)
  const layoutMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
  const geos: THREE.BufferGeometry[] = []
  for (const { char, x, y } of charInfos) {
    const charGeo = buildCharGeometry(font, char, fontSize)
    if (!charGeo) continue
    charGeo.translate(x, y, 0)
    charGeo.computeBoundingBox()
    const b = charGeo.boundingBox!
    layoutMin.x = Math.min(layoutMin.x, b.min.x)
    layoutMin.y = Math.min(layoutMin.y, b.min.y)
    layoutMin.z = Math.min(layoutMin.z, b.min.z)
    layoutMax.x = Math.max(layoutMax.x, b.max.x)
    layoutMax.y = Math.max(layoutMax.y, b.max.y)
    layoutMax.z = Math.max(layoutMax.z, b.max.z)
    geos.push(charGeo)
  }
  const center = new THREE.Vector3()
  center.addVectors(layoutMin, layoutMax).multiplyScalar(0.5)
  const size = new THREE.Vector3().subVectors(layoutMax, layoutMin)
  const maxDim = Math.max(size.x, size.y, size.z)
  const scale = maxDim > 0 ? targetScale / maxDim : 1
  const geo = mergeGeometries(geos)
  geos.forEach((g) => g.dispose())
  if (!geo) {
    throw new Error('[LoadingParticles] mergeGeometries returned null')
  }
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, (pos.getX(i) - center.x) * scale)
    pos.setY(i, (pos.getY(i) - center.y) * scale)
    pos.setZ(i, (pos.getZ(i) - center.z) * scale)
  }
  pos.needsUpdate = true
  geo.computeBoundingSphere()
  geo.computeBoundingBox()
  const hitboxPadding = Math.round(280 * (targetScale / 1000))
  geo.boundingBox!.expandByScalar(hitboxPadding)
  if (geo.boundingSphere) geo.boundingSphere.radius += hitboxPadding
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      visible: false,
      side: THREE.DoubleSide,
    })
  )
  mesh.visible = false
  return mesh
}

/** Welcome overlay — particle title line */
export const PARTICLE_LINES_WELCOME = ['Yggdrasil'] as const

const DEFAULT_FONT_SIZE = 44
const LINE_GAP_BASE = 4
const DEFAULT_TARGET_SCALE = 1000
const HOLLOW_BRIGHTNESS = 1.18
const MS_BRIGHTNESS = 1.1

function buildCharGeometry(font: Font, char: string, fontSize: number): THREE.BufferGeometry | null {
  const extrudeOpts = {
    depth: 8,
    curveSegments: 5,
    bevelEnabled: false,
    bevelThickness: 10,
    bevelSize: 8,
  }
  const shapes = font.generateShapes(char, fontSize)
  if (!shapes.length) return null
  const geoMain = new ExtrudeGeometry(shapes, extrudeOpts)
  const holeFillShapes: Shape[] = []
  shapes.forEach((shape) => {
    shape.holes.forEach((hole) => {
      const fill = new Shape()
      fill.curves = hole.curves.map((c: THREE.Curve<THREE.Vector2>) => c.clone())
      holeFillShapes.push(fill)
    })
  })
  if (holeFillShapes.length === 0) return geoMain
  const geoHoles = new ExtrudeGeometry(holeFillShapes, extrudeOpts)
  const g = mergeGeometries([geoMain, geoHoles])
  if (!g) {
    geoHoles.dispose()
    return geoMain
  }
  geoMain.dispose()
  geoHoles.dispose()
  return g
}

function makeSampledData(
  font: Font,
  hollowSet: Set<string>,
  totalSamples: number,
  lines: readonly string[],
  fontSize: number,
  targetScale: number,
  lineGap: number
): { positions: Float32Array; uvs: Float32Array; brightnessScale: Float32Array } {
  const charInfos = getLayoutCharInfos(font, lines, fontSize, lineGap)
  const numChars = charInfos.length
  if (numChars === 0) {
    const positions = new Float32Array(3 * totalSamples)
    const uvs = new Float32Array(2 * totalSamples)
    const brightnessScale = new Float32Array(totalSamples)
    brightnessScale.fill(1)
    return { positions, uvs, brightnessScale }
  }

  const charGeos: (THREE.BufferGeometry | null)[] = []
  const layoutMin = new THREE.Vector3(Infinity, Infinity, Infinity)
  const layoutMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity)

  for (let c = 0; c < numChars; c++) {
    const { char, x, y } = charInfos[c]
    const geo = buildCharGeometry(font, char, fontSize)
    charGeos.push(geo)
    if (geo) {
      geo.computeBoundingBox()
      const b = geo.boundingBox!
      layoutMin.x = Math.min(layoutMin.x, x + b.min.x)
      layoutMin.y = Math.min(layoutMin.y, y + b.min.y)
      layoutMin.z = Math.min(layoutMin.z, b.min.z)
      layoutMax.x = Math.max(layoutMax.x, x + b.max.x)
      layoutMax.y = Math.max(layoutMax.y, y + b.max.y)
      layoutMax.z = Math.max(layoutMax.z, b.max.z)
    }
  }

  const center = new THREE.Vector3()
  center.addVectors(layoutMin, layoutMax).multiplyScalar(0.5)
  const size = new THREE.Vector3().subVectors(layoutMax, layoutMin)
  const maxDim = Math.max(size.x, size.y, size.z)
  const scale = maxDim > 0 ? targetScale / maxDim : 1
  const pos = new THREE.Vector3()
  const dummyMaterial = new THREE.MeshBasicMaterial({ visible: false })

  const areas: number[] = []
  for (let c = 0; c < numChars; c++) {
    const geo = charGeos[c]
    if (!geo) {
      areas.push(0)
      continue
    }
    const b = geo.boundingBox!
    const sx = b.max.x - b.min.x
    const sy = b.max.y - b.min.y
    const sz = b.max.z - b.min.z
    areas.push(2 * (sx * sy + sy * sz + sz * sx) || 1)
  }
  const totalArea = areas.reduce((a, b) => a + b, 0)
  const samplesPerChar: number[] = []
  let allocated = 0
  for (let c = 0; c < numChars; c++) {
    const n =
      c < numChars - 1
        ? Math.round((totalSamples * areas[c]) / totalArea)
        : totalSamples - allocated
    samplesPerChar.push(Math.max(0, Math.min(n, totalSamples - allocated)))
    allocated += samplesPerChar[samplesPerChar.length - 1]
  }

  const positions = new Float32Array(3 * totalSamples)
  const uvs = new Float32Array(2 * totalSamples)
  const brightnessScale = new Float32Array(totalSamples)
  let writeIndex = 0

  for (let c = 0; c < numChars; c++) {
    const geo = charGeos[c]
    const { char, x, y } = charInfos[c]
    const n = samplesPerChar[c]
    const bright = hollowSet.has(char) ? HOLLOW_BRIGHTNESS : MS_BRIGHTNESS

    if (!geo || n <= 0) {
      if (geo) geo.dispose()
      continue
    }

    const mesh = new THREE.Mesh(geo, dummyMaterial)
    const sampler = new MeshSurfaceSampler(mesh).build()

    for (let s = 0; s < n && writeIndex < totalSamples; s++) {
      sampler.sample(pos)
      pos.x = (pos.x + x - center.x) * scale
      pos.y = (pos.y + y - center.y) * scale
      pos.z = (pos.z - center.z) * scale

      const i = writeIndex
      positions[3 * i] = pos.x
      positions[3 * i + 1] = pos.y
      positions[3 * i + 2] = pos.z
      uvs[2 * i] = (i % PARTICLE_GRID_SIZE) / (PARTICLE_GRID_SIZE - 1)
      uvs[2 * i + 1] = Math.floor(i / PARTICLE_GRID_SIZE) / (PARTICLE_GRID_SIZE - 1)
      brightnessScale[i] = bright
      writeIndex++
    }

    mesh.geometry.dispose()
  }

  while (writeIndex < totalSamples) {
    const src = writeIndex - 1
    if (src >= 0) {
      positions[3 * writeIndex] = positions[3 * src]
      positions[3 * writeIndex + 1] = positions[3 * src + 1]
      positions[3 * writeIndex + 2] = positions[3 * src + 2]
      uvs[2 * writeIndex] = uvs[2 * src]
      uvs[2 * writeIndex + 1] = uvs[2 * src + 1]
      brightnessScale[writeIndex] = brightnessScale[src]
    } else {
      brightnessScale[writeIndex] = 1
    }
    writeIndex++
  }

  dummyMaterial.dispose()
  return { positions, uvs, brightnessScale }
}

/** `lightGold`: gold idle pulse + blue repel; use `clearColorHex` with drei `Environment` instead of white fill. */
export type LoadingParticlesAppearance = 'dark' | 'lightGold'

export default function LoadingParticles({
  transparentBackground = false,
  lines,
  lowBloom = false,
  textScale = 1,
  particleSizeScale = 1,
  titleOffsetYPx = 0,
  cursorRepelHex,
  appearance = 'dark',
  /** When set, used as WebGL clear (e.g. dark base under drei `Environment` background). */
  clearColorHex,
  onReady,
}: {
  transparentBackground?: boolean
  /** One or two lines of Norse particle text */
  lines: readonly string[]
  /** Softer UnrealBloomPass (e.g. loading “Presents” screen) */
  lowBloom?: boolean
  /** Scales layout, world size, and base point size together (e.g. 1.35 on loading) */
  textScale?: number
  /** Multiplies point sprite size only (finer / chunkier dots without changing letter layout) */
  particleSizeScale?: number
  /** Extra vertical offset in screen px (negative = up); pairs with DOM subtitle under welcome title */
  titleOffsetYPx?: number
  /** Cursor repel tint as `#RRGGBB`; omit for default loading colour (#63E5FF) */
  cursorRepelHex?: string
  appearance?: LoadingParticlesAppearance
  clearColorHex?: number
  onReady?: () => void
}) {
  const { gl, scene, camera, invalidate } = useThree()
  const groupRef = useRef<THREE.Group | null>(null)
  const gpgpuRef = useRef<GPGPU | null>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const composerRef = useRef<EffectComposer | null>(null)
  const bloomPassRef = useRef<UnrealBloomPass | null>(null)
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseNDCRef = useRef(new THREE.Vector2(0, 0))
  const lastNDCRef = useRef(new THREE.Vector2(0, 0))
  const mouseSpeedRef = useRef(0)
  const isOverCanvasRef = useRef(false)
  const cancelledRef = useRef(false)
  const cleanupRef = useRef<(() => void) | null>(null)
  const hollowGlyphSetRef = useRef<Set<string> | null>(null)
  const worldBoxRef = useRef(new THREE.Box3())
  const boxHitRef = useRef(new THREE.Vector3())
  const lowBloomRef = useRef(lowBloom)
  lowBloomRef.current = lowBloom
  const appearanceRef = useRef(appearance)
  appearanceRef.current = appearance
  const titleOffsetYPxRef = useRef(titleOffsetYPx)
  titleOffsetYPxRef.current = titleOffsetYPx
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const didNotifyReadyRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    didNotifyReadyRef.current = false
    const fontSize = Math.round(DEFAULT_FONT_SIZE * textScale)
    const targetScale = DEFAULT_TARGET_SCALE * textScale
    const lineGap = Math.max(2, Math.round(LINE_GAP_BASE * textScale))
    const particlePointSize = Math.round(2200 * textScale * particleSizeScale)

    if (transparentBackground) {
      gl.setClearColor(0x000000, 0)
    } else if (clearColorHex != null) {
      gl.setClearColor(clearColorHex, 1)
    } else if (appearance === 'lightGold') {
      gl.setClearColor(0xf5f4f2, 1)
    } else {
      gl.setClearColor(0x050510, 1)
    }
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = appearance === 'lightGold' ? 1.14 : 1.2
    gl.outputColorSpace = THREE.SRGBColorSpace

    const sizes = {
      width: gl.domElement.clientWidth || window.innerWidth,
      height: gl.domElement.clientHeight || window.innerHeight,
    }
    const mouse = { cursorPosition: new THREE.Vector3() }
    const repelColor =
      cursorRepelHex != null && cursorRepelHex !== ''
        ? new THREE.Color(cursorRepelHex)
        : PARTICLE_CURSOR_ACCENT
    const goldIdle = new THREE.Color('#f2d56a')
    const goldIdleLow = new THREE.Color('#a6842e')
    const params = {
      color: appearance === 'lightGold' ? goldIdle.clone() : PARTICLE_COLOR.clone(),
      idleLowColor: appearance === 'lightGold' ? goldIdleLow.clone() : undefined,
      cursorColor: repelColor.clone(),
      size: particlePointSize,
      minAlpha: appearance === 'lightGold' ? 0.92 : 0.88,
      maxAlpha: 1.0,
      force: 0.90,
    }

    function createMeshAndInit(
      mesh: THREE.Mesh,
      sampledData?: { positions: Float32Array; uvs: Float32Array; brightnessScale: Float32Array }
    ) {
      if (cancelledRef.current) {
        mesh.geometry.dispose()
        return
      }
      const group = new THREE.Group()
      scene.add(group)
      group.add(mesh)
      groupRef.current = group
      meshRef.current = mesh

      const gpgpu = new GPGPU({
        size: PARTICLE_GRID_SIZE,
        camera,
        renderer: gl,
        mouse,
        scene: group,
        model: mesh,
        sizes,
        params,
        sampledData,
        events: {
          update: () => {
            mouseSpeedRef.current *= 0.76
            const u = gpgpu.uniforms.velocityUniforms.uMouseSpeed as { value: number }
            if (u) u.value = mouseSpeedRef.current
          },
        },
      })
      gpgpuRef.current = gpgpu
      ;(gpgpu.uniforms.velocityUniforms.uMouse as { value: THREE.Vector3 }).value.set(1e6, 1e6, 1e6)
      ;(gpgpu.uniforms.velocityUniforms.uMouseActive as { value: number }).value = 0

      if (transparentBackground) {
        composerRef.current = null
        bloomPassRef.current = null
      } else {
        const composer = new EffectComposer(gl)
        composer.addPass(new RenderPass(scene, camera))
        const bloomDims = new THREE.Vector2(sizes.width, sizes.height)
        let bStrength: number
        let bRadius: number
        let bThreshold: number
        if (appearance === 'lightGold') {
          bStrength = 0.07
          bRadius = 0.08
          bThreshold = 0.88
        } else if (lowBloom) {
          bStrength = 0.16
          bRadius = 0.12
          bThreshold = 0.72
        } else {
          bStrength = 0.95
          bRadius = 0.38
          bThreshold = 0.5
        }
        const bloomPass = new UnrealBloomPass(bloomDims, bStrength, bRadius, bThreshold)
        composer.addPass(bloomPass)
        bloomPassRef.current = bloomPass
        composerRef.current = composer
      }

      const onResize = () => {
        const w = gl.domElement.clientWidth || window.innerWidth
        const h = gl.domElement.clientHeight || window.innerHeight
        gpgpu.material.uniforms.uResolution.value.set(w, h)
        composerRef.current?.setSize(w, h)
        composerRef.current?.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      }
      const canvas = gl.domElement
      const onMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect()
        const inside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        isOverCanvasRef.current = inside
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1
        mouseNDCRef.current.set(nx, ny)
        mouseSpeedRef.current = Math.min(
          Math.hypot(nx - lastNDCRef.current.x, ny - lastNDCRef.current.y) * 1600,
          3.2
        )
        lastNDCRef.current.set(nx, ny)
      }
      window.addEventListener('resize', onResize)
      window.addEventListener('mousemove', onMouseMove)
      const raf = requestAnimationFrame(() => invalidate())
      cleanupRef.current = () => {
        cancelAnimationFrame(raf)
        window.removeEventListener('resize', onResize)
        window.removeEventListener('mousemove', onMouseMove)
        scene.remove(group)
        gpgpu.mesh.geometry.dispose()
        gpgpu.material.dispose()
        gpgpu.utils.getPositionTexture().dispose()
        gpgpu.utils.getVelocityTexture().dispose()
        composerRef.current?.dispose()
        composerRef.current = null
        bloomPassRef.current = null
        groupRef.current = null
        gpgpuRef.current = null
        meshRef.current = null
      }

      if (!didNotifyReadyRef.current) {
        didNotifyReadyRef.current = true
        onReadyRef.current?.()
      }
    }

    const loader = new FontLoader()
    loader.load(
      '/norse_font/Norsebold.json',
      (font) => {
        if (cancelledRef.current) return
        hollowGlyphSetRef.current = getHollowGlyphSet(font)
        if (process.env.NODE_ENV === 'development') {
          // Debug note removed: printing full glyph sets can emit noisy unreadable console output.
        }
        const mesh = makeTextMesh(font, lines, fontSize, targetScale, lineGap)
        const sampledData = makeSampledData(
          font,
          hollowGlyphSetRef.current,
          PARTICLE_GRID_SIZE * PARTICLE_GRID_SIZE,
          lines,
          fontSize,
          targetScale,
          lineGap
        )
        createMeshAndInit(mesh, sampledData)
      },
      undefined,
      () => {
        createMeshAndInit(makeSphereMesh())
      }
    )

    return () => {
      cancelledRef.current = true
      cleanupRef.current?.()
    }
  }, [
    gl,
    scene,
    camera,
    invalidate,
    transparentBackground,
    lowBloom,
    textScale,
    particleSizeScale,
    lines.join('\0'),
    cursorRepelHex,
    appearance,
    clearColorHex,
  ])

  // Priority 1: take over rendering so R3F does not run gl.render() after this and overwrite our composer output
  useFrame(() => {
    const gpgpu = gpgpuRef.current
    const group = groupRef.current
    const mesh = meshRef.current
    const composer = composerRef.current
    if (!gpgpu || !group || !mesh) return

    const t = performance.now() * 0.001

    const dir = new THREE.Vector3()
    const camUp = new THREE.Vector3()
    camera.getWorldDirection(dir)
    group.position.copy(camera.position).add(dir.multiplyScalar(DISTANCE_IN_FRONT))
    const fov = 'fov' in camera ? (camera as THREE.PerspectiveCamera).fov : 60
    const viewportHeight = gl.domElement.clientHeight || window.innerHeight || 1
    const worldUnitsPerPixel =
      (2 * Math.tan(THREE.MathUtils.degToRad(fov * 0.5)) * DISTANCE_IN_FRONT) / viewportHeight
    camUp.set(0, 1, 0).applyQuaternion(camera.quaternion)
    group.position.addScaledVector(
      camUp,
      (TITLE_SCREEN_OFFSET_Y_PX + titleOffsetYPxRef.current) * worldUnitsPerPixel
    )
    group.quaternion.copy(camera.quaternion)
    const breath = 1.0 + MESH_BREATH_AMPLITUDE * Math.sin(t * MESH_BREATH_FREQ)
    group.scale.setScalar(breath)
    group.updateMatrixWorld(true)

    raycasterRef.current.setFromCamera(mouseNDCRef.current, camera)
    const intersects = raycasterRef.current.intersectObject(mesh, false)
    const uMouse = (gpgpu.uniforms.velocityUniforms.uMouse as { value: THREE.Vector3 }).value
    const uMouseRayStart = (gpgpu.uniforms.velocityUniforms.uMouseRayStart as { value: THREE.Vector3 }).value
    const uMouseRayEnd = (gpgpu.uniforms.velocityUniforms.uMouseRayEnd as { value: THREE.Vector3 }).value
    const uMouseActive = gpgpu.uniforms.velocityUniforms.uMouseActive as { value: number }
    const far = 1e6

    if (isOverCanvasRef.current && intersects.length > 0) {
      const first = intersects[0].point.clone()
      const last = intersects[intersects.length - 1].point.clone()
      group.worldToLocal(first)
      group.worldToLocal(last)
      uMouse.copy(first)
      uMouseRayStart.copy(first)
      uMouseRayEnd.copy(last)
      uMouseActive.value = 1
    } else if (isOverCanvasRef.current && mesh.geometry.boundingBox) {
      worldBoxRef.current.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld)
      const hit = raycasterRef.current.ray.intersectBox(worldBoxRef.current, boxHitRef.current)
      if (hit) {
        group.worldToLocal(boxHitRef.current)
        uMouse.copy(boxHitRef.current)
        uMouseRayStart.copy(boxHitRef.current)
        uMouseRayEnd.copy(boxHitRef.current)
        uMouseActive.value = 1
      } else {
        uMouse.set(far, far, far)
        uMouseRayStart.set(far, far, far)
        uMouseRayEnd.set(far, far, far)
        uMouseActive.value = 0
      }
    } else {
      uMouse.set(far, far, far)
      uMouseRayStart.set(far, far, far)
      uMouseRayEnd.set(far, far, far)
      uMouseActive.value = 0
    }

    const uTime = gpgpu.uniforms.velocityUniforms.uTime as { value: number }
    if (uTime) uTime.value = t
    gpgpu.material.uniforms.uIdleTime.value = t

    const pulse = 0.5 + 0.5 * Math.sin(t * 1.8)
    if (bloomPassRef.current) {
      if (appearanceRef.current === 'lightGold') {
        bloomPassRef.current.strength = 0.055 + pulse * 0.035
        bloomPassRef.current.radius = 0.065 + pulse * 0.03
      } else if (lowBloomRef.current) {
        bloomPassRef.current.strength = 0.12 + pulse * 0.08
        bloomPassRef.current.radius = 0.08 + pulse * 0.04
      } else {
        bloomPassRef.current.strength = 0.82 + pulse * 0.36
        bloomPassRef.current.radius = 0.32 + pulse * 0.14
      }
    }

    gpgpu.compute()
    gpgpu.material.uniforms.uPositionTexture.value =
      gpgpu.gpgpuCompute.getCurrentRenderTarget(gpgpu.positionVariable).texture
    gpgpu.material.uniforms.uVelocityTexture.value =
      gpgpu.gpgpuCompute.getCurrentRenderTarget(gpgpu.velocityVariable).texture

    if (composer) {
      composer.render()
    } else {
      gl.clearDepth()
      gl.render(scene, camera)
    }
    invalidate()
  }, 1)

  return null
}
