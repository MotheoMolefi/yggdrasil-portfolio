'use client'

/**
 * LoadingParticles — Dreamy particle effect shaped as text (Norse Bold) or fallback sphere.
 * Uses FontLoader + TextGeometry when /norse_font/Norsebold.json is available.
 */

import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import GPGPU from '@/app/lib/codrops/GPGPU'

const PARTICLE_GRID_SIZE = 280
const DISTANCE_IN_FRONT = 800
const GOLD = new THREE.Color(0.808, 0.647, 0.239)

function makeSphereMesh(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(280, 64, 64)
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }))
  mesh.visible = false
  return mesh
}

function makeTextMesh(font: unknown): THREE.Mesh {
  const geo = new TextGeometry('Yggdrasil', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    font: font as any,
    size: 58,
    height: 16,
    curveSegments: 5,
  })
  geo.computeBoundingBox()
  const bbox = geo.boundingBox!
  const center = new THREE.Vector3()
  bbox.getCenter(center)
  geo.translate(-center.x, -center.y, -center.z)
  const size = new THREE.Vector3()
  bbox.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z)
  const scale = 850 / maxDim
  // Scale geometry vertices so MeshSurfaceSampler (which reads local geometry) gets correct size
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) * scale)
    pos.setY(i, pos.getY(i) * scale)
    pos.setZ(i, pos.getZ(i) * scale)
  }
  pos.needsUpdate = true
  geo.computeBoundingSphere()
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }))
  mesh.visible = false
  return mesh
}

export default function LoadingParticles() {
  const { gl, scene, camera, invalidate } = useThree()
  const groupRef = useRef<THREE.Group | null>(null)
  const gpgpuRef = useRef<GPGPU | null>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const composerRef = useRef<EffectComposer | null>(null)
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseNDCRef = useRef(new THREE.Vector2(0, 0))
  const lastNDCRef = useRef(new THREE.Vector2(0, 0))
  const mouseSpeedRef = useRef(0)
  const hitPointRef = useRef(new THREE.Vector3())
  const cancelledRef = useRef(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    cancelledRef.current = false
    gl.setClearColor(0x050510, 1)
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.2
    gl.outputColorSpace = THREE.SRGBColorSpace

    const sizes = {
      width: gl.domElement.clientWidth || window.innerWidth,
      height: gl.domElement.clientHeight || window.innerHeight,
    }
    const mouse = { cursorPosition: new THREE.Vector3() }
    const params = {
      color: GOLD.clone(),
      size: 1000,
      minAlpha: 0.48,
      maxAlpha: 1.0,
      force: 0.82,
    }

    function createMeshAndInit(mesh: THREE.Mesh) {
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
        events: {
          update: () => {
            mouseSpeedRef.current *= 0.85
            const u = gpgpu.uniforms.velocityUniforms.uMouseSpeed as { value: number }
            if (u) u.value = mouseSpeedRef.current
          },
        },
      })
      gpgpuRef.current = gpgpu
      ;(gpgpu.uniforms.velocityUniforms.uMouse as { value: THREE.Vector3 }).value.set(1e6, 1e6, 1e6)
      ;(gpgpu.uniforms.velocityUniforms.uMouseActive as { value: number }).value = 0

      const composer = new EffectComposer(gl)
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(
        new UnrealBloomPass(
          new THREE.Vector2(sizes.width, sizes.height),
          1.8,
          0.5,
          0.02
        )
      )
      composerRef.current = composer

      const onResize = () => {
        const w = gl.domElement.clientWidth || window.innerWidth
        const h = gl.domElement.clientHeight || window.innerHeight
        gpgpu.material.uniforms.uResolution.value.set(w, h)
        composer.setSize(w, h)
        composer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      }
      const onMouseMove = (e: MouseEvent) => {
        const nx = (e.clientX / window.innerWidth) * 2 - 1
        const ny = (e.clientY / window.innerHeight) * -2 + 1
        mouseNDCRef.current.set(nx, ny)
        mouseSpeedRef.current = Math.min(
          Math.hypot(nx - lastNDCRef.current.x, ny - lastNDCRef.current.y) * 800,
          1.5
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
        composer.dispose()
        composerRef.current = null
        groupRef.current = null
        gpgpuRef.current = null
        meshRef.current = null
      }
    }

    const loader = new FontLoader()
    loader.load(
      '/norse_font/Norsebold.json',
      (font) => {
        if (cancelledRef.current) return
        createMeshAndInit(makeTextMesh(font))
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
  }, [gl, scene, camera, invalidate])

  // Priority 1: take over rendering so R3F does not run gl.render() after this and overwrite our composer output
  useFrame(() => {
    const gpgpu = gpgpuRef.current
    const group = groupRef.current
    const mesh = meshRef.current
    const composer = composerRef.current
    if (!gpgpu || !group || !mesh || !composer) return

    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    group.position.copy(camera.position).add(dir.multiplyScalar(DISTANCE_IN_FRONT))
    group.rotation.y += 0.004
    group.updateMatrixWorld(true)

    raycasterRef.current.setFromCamera(mouseNDCRef.current, camera)
    const intersects = raycasterRef.current.intersectObject(mesh, false)
    const uMouseVal = (gpgpu.uniforms.velocityUniforms.uMouse as { value: THREE.Vector3 }).value
    const uMouseActive = gpgpu.uniforms.velocityUniforms.uMouseActive as { value: number }
    if (intersects.length > 0) {
      hitPointRef.current.copy(intersects[0].point)
      group.worldToLocal(hitPointRef.current)
      uMouseVal.copy(hitPointRef.current)
      uMouseActive.value = 1
    } else {
      uMouseVal.set(1e6, 1e6, 1e6)
      uMouseActive.value = 0
    }

    const uTime = gpgpu.uniforms.velocityUniforms.uTime as { value: number }
    if (uTime) uTime.value = performance.now() * 0.001

    gpgpu.compute()
    gpgpu.material.uniforms.uPositionTexture.value =
      gpgpu.gpgpuCompute.getCurrentRenderTarget(gpgpu.positionVariable).texture
    gpgpu.material.uniforms.uVelocityTexture.value =
      gpgpu.gpgpuCompute.getCurrentRenderTarget(gpgpu.velocityVariable).texture

    composer.render()
    invalidate()
  }, 1)

  return null
}
