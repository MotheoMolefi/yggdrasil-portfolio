'use client'

import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import GPGPU from '@/app/lib/codrops/GPGPU'
import { burstVertexShader, burstFragmentShader } from '@/app/lib/codrops/shaders'

const PARTICLE_GRID_SIZE = 280
const DISTANCE_IN_FRONT = 800
const GOLD = new THREE.Color(0.85, 0.65, 0.13)
const LIGHT_ORBIT_RADIUS = 500
const LIGHT_HEIGHT = 400
const BURST_INTERVAL_MIN = 2000
const BURST_INTERVAL_MAX = 3000
const BURST_PARTICLE_COUNT = 80

function makeSphereMesh(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(280, 64, 64)
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }))
  mesh.visible = false
  return mesh
}

function makeTextMesh(font: unknown): THREE.Mesh {
  const geo = new TextGeometry('YGGDRASIL', {
    font: font as THREE.Font,
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

function createBurstParticles(position: THREE.Vector3): THREE.Points {
  const positions = new Float32Array(BURST_PARTICLE_COUNT * 3)
  const velocities = new Float32Array(BURST_PARTICLE_COUNT * 3)
  const scales = new Float32Array(BURST_PARTICLE_COUNT)
  const lives = new Float32Array(BURST_PARTICLE_COUNT)

  for (let i = 0; i < BURST_PARTICLE_COUNT; i++) {
    positions[i * 3] = position.x
    positions[i * 3 + 1] = position.y
    positions[i * 3 + 2] = position.z

    const theta = Math.random() * Math.PI * 2
    const phi = Math.random() * Math.PI
    const speed = 0.8 + Math.random() * 2.0
    velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed
    velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed
    velocities[i * 3 + 2] = Math.cos(phi) * speed

    scales[i] = 0.8 + Math.random() * 2.0
    lives[i] = 0.6 + Math.random() * 0.4
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3))
  geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
  geometry.setAttribute('aLife', new THREE.BufferAttribute(lives, 1))

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: GOLD.clone() },
      uTime: { value: 0 },
      uBurstTime: { value: 0 },
    },
    vertexShader: burstVertexShader,
    fragmentShader: burstFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  return new THREE.Points(geometry, material)
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
  const lightAngleRef = useRef(0)
  const hoverStrengthRef = useRef(0)
  const isHoveringRef = useRef(false)
  const burstParticlesRef = useRef<THREE.Points[]>([])
  const lastBurstTimeRef = useRef(0)
  const nextBurstIntervalRef = useRef(BURST_INTERVAL_MIN + Math.random() * (BURST_INTERVAL_MAX - BURST_INTERVAL_MIN))
  const burstPositionsRef = useRef<THREE.Vector3[]>([])

  useEffect(() => {
    cancelledRef.current = false
    gl.setClearColor(0x050510, 1)
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.5
    gl.outputColorSpace = THREE.SRGBColorSpace

    const sizes = {
      width: gl.domElement.clientWidth || window.innerWidth,
      height: gl.domElement.clientHeight || window.innerHeight,
    }
    const mouse = { cursorPosition: new THREE.Vector3() }
    const params = {
      color: GOLD.clone(),
      size: 1200,
      minAlpha: 0.55,
      maxAlpha: 1.0,
      force: 0.85,
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
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(sizes.width, sizes.height),
        2.2,
        0.6,
        0.01
      )
      composer.addPass(bloomPass)
      composerRef.current = composer

      const bbox = mesh.geometry.boundingBox
      if (bbox) {
        const min = bbox.min
        const max = bbox.max
        const midX = (min.x + max.x) / 2
        const midY = (min.y + max.y) / 2
        burstPositionsRef.current = [
          new THREE.Vector3(min.x, min.y, 0),
          new THREE.Vector3(max.x, min.y, 0),
          new THREE.Vector3(min.x, max.y, 0),
          new THREE.Vector3(max.x, max.y, 0),
          new THREE.Vector3(midX, min.y, 0),
          new THREE.Vector3(midX, max.y, 0),
          new THREE.Vector3(min.x, midY, 0),
          new THREE.Vector3(max.x, midY, 0),
        ]
      }

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
          Math.hypot(nx - lastNDCRef.current.x, ny - lastNDCRef.current.y) * 1000,
          2.0
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
        burstParticlesRef.current.forEach((p) => {
          p.geometry.dispose()
          ;(p.material as THREE.Material).dispose()
        })
        burstParticlesRef.current = []
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

  useFrame(() => {
    const gpgpu = gpgpuRef.current
    const group = groupRef.current
    const mesh = meshRef.current
    const composer = composerRef.current
    if (!gpgpu || !group || !mesh || !composer) return

    const time = performance.now() * 0.001

    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    group.position.copy(camera.position).add(dir.multiplyScalar(DISTANCE_IN_FRONT))
    group.rotation.y += 0.005
    group.updateMatrixWorld(true)

    lightAngleRef.current += 0.012
    const lightX = Math.cos(lightAngleRef.current) * LIGHT_ORBIT_RADIUS
    const lightZ = Math.sin(lightAngleRef.current) * LIGHT_ORBIT_RADIUS
    const lightY = LIGHT_HEIGHT + Math.sin(lightAngleRef.current * 0.7) * 80
    const lightPosition = new THREE.Vector3(lightX, lightY, lightZ)

    const uLightPosVel = gpgpu.uniforms.velocityUniforms.uLightPosition as { value: THREE.Vector3 }
    if (uLightPosVel) uLightPosVel.value.copy(lightPosition)

    const uLightPosMat = gpgpu.material.uniforms.uLightPosition as { value: THREE.Vector3 }
    if (uLightPosMat) uLightPosMat.value.copy(lightPosition)

    const uCamPos = gpgpu.material.uniforms.uCameraPosition as { value: THREE.Vector3 }
    if (uCamPos) uCamPos.value.copy(camera.position)

    const targetHover = isHoveringRef.current ? 1.5 : 0.0
    hoverStrengthRef.current += (targetHover - hoverStrengthRef.current) * 0.15
    const uHoverStrength = gpgpu.uniforms.velocityUniforms.uHoverStrength as { value: number }
    if (uHoverStrength) uHoverStrength.value = hoverStrengthRef.current

    raycasterRef.current.setFromCamera(mouseNDCRef.current, camera)
    const intersects = raycasterRef.current.intersectObject(mesh, false)
    const uMouseVal = (gpgpu.uniforms.velocityUniforms.uMouse as { value: THREE.Vector3 }).value
    const uMouseActive = gpgpu.uniforms.velocityUniforms.uMouseActive as { value: number }
    if (intersects.length > 0) {
      hitPointRef.current.copy(intersects[0].point)
      group.worldToLocal(hitPointRef.current)
      uMouseVal.copy(hitPointRef.current)
      uMouseActive.value = 1
      isHoveringRef.current = true
    } else {
      uMouseVal.set(1e6, 1e6, 1e6)
      uMouseActive.value = 0
      isHoveringRef.current = false
    }

    const uTime = gpgpu.uniforms.velocityUniforms.uTime as { value: number }
    if (uTime) uTime.value = time

    const uTimeMat = gpgpu.material.uniforms.uTime as { value: number }
    if (uTimeMat) uTimeMat.value = time

    if (time * 1000 - lastBurstTimeRef.current > nextBurstIntervalRef.current) {
      lastBurstTimeRef.current = time * 1000
      nextBurstIntervalRef.current = BURST_INTERVAL_MIN + Math.random() * (BURST_INTERVAL_MAX - BURST_INTERVAL_MIN)

      if (burstPositionsRef.current.length > 0) {
        const randomPos = burstPositionsRef.current[Math.floor(Math.random() * burstPositionsRef.current.length)]
        const burstPos = randomPos.clone()
        burstPos.applyMatrix4(group.matrixWorld)

        const burst = createBurstParticles(burstPos)
        ;(burst.material as THREE.ShaderMaterial).uniforms.uBurstTime.value = time
        scene.add(burst)
        burstParticlesRef.current.push(burst)

        const uBurstActive = gpgpu.material.uniforms.uBurstActive as { value: number }
        const uBurstPosition = gpgpu.material.uniforms.uBurstPosition as { value: THREE.Vector3 }
        if (uBurstActive && uBurstPosition) {
          uBurstActive.value = 1
          uBurstPosition.copy(randomPos)
          setTimeout(() => {
            if (gpgpuRef.current) {
              const active = gpgpuRef.current.material.uniforms.uBurstActive as { value: number }
              if (active) active.value = 0
            }
          }, 400)
        }
      }
    }

    burstParticlesRef.current = burstParticlesRef.current.filter((burst) => {
      const mat = burst.material as THREE.ShaderMaterial
      mat.uniforms.uTime.value = time
      const age = time - mat.uniforms.uBurstTime.value
      if (age > 2.5) {
        scene.remove(burst)
        burst.geometry.dispose()
        mat.dispose()
        return false
      }
      return true
    })

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
