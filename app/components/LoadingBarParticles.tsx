'use client'

import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import GPGPU from '@/app/lib/codrops/GPGPU'
import { PARTICLE_CURSOR_ACCENT } from '../lib/codrops/particleCursorColor'

const BAR_GRID_SIZE = 48
const DISTANCE_IN_FRONT = 800
const BAR_Y_OFFSET = -380
const BAR_COLOR = new THREE.Color(0.4, 0.75, 0.9)

function makePillSampledData(): {
  positions: Float32Array
  uvs: Float32Array
  brightnessScale: Float32Array
  progressCoord: Float32Array
} {
  const geo = new THREE.CapsuleGeometry(0.05, 0.9, 4, 16)
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }))
  mesh.rotation.z = -Math.PI / 2
  mesh.scale.set(600, 60, 60)
  mesh.position.y = BAR_Y_OFFSET
  mesh.updateMatrixWorld(true)
  geo.computeBoundingBox()
  const worldBox = geo.boundingBox!.clone().applyMatrix4(mesh.matrixWorld)
  const minX = worldBox.min.x
  const maxX = worldBox.max.x
  const spanX = maxX - minX || 1

  const n = BAR_GRID_SIZE * BAR_GRID_SIZE
  const positions = new Float32Array(3 * n)
  const uvs = new Float32Array(2 * n)
  const brightnessScale = new Float32Array(n)
  const progressCoord = new Float32Array(n)
  brightnessScale.fill(1)

  const sampler = new MeshSurfaceSampler(mesh).build()
  const pos = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    sampler.sample(pos)
    positions[3 * i] = pos.x
    positions[3 * i + 1] = pos.y
    positions[3 * i + 2] = pos.z
    uvs[2 * i] = (i % BAR_GRID_SIZE) / (BAR_GRID_SIZE - 1)
    uvs[2 * i + 1] = Math.floor(i / BAR_GRID_SIZE) / (BAR_GRID_SIZE - 1)
    progressCoord[i] = (pos.x - minX) / spanX
  }
  mesh.geometry.dispose()
  return { positions, uvs, brightnessScale, progressCoord }
}

export default function LoadingBarParticles({ progress }: { progress: number }) {
  const { scene, camera, gl, invalidate } = useThree()
  const groupRef = useRef<THREE.Group | null>(null)
  const gpgpuRef = useRef<GPGPU | null>(null)

  useEffect(() => {
    const group = new THREE.Group()
    scene.add(group)
    groupRef.current = group

    const sizes = {
      width: gl.domElement.clientWidth || window.innerWidth,
      height: gl.domElement.clientHeight || window.innerHeight,
    }
    const sampledData = makePillSampledData()
    const dummyMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ visible: false })
    )
    const gpgpu = new GPGPU({
      size: BAR_GRID_SIZE,
      camera,
      renderer: gl,
      mouse: { cursorPosition: new THREE.Vector3() },
      scene: group,
      model: dummyMesh,
      sizes,
      params: {
        color: BAR_COLOR.clone(),
        cursorColor: PARTICLE_CURSOR_ACCENT.clone(),
        size: 800,
        minAlpha: 0.5,
        maxAlpha: 0.9,
        force: 0.82,
      },
      sampledData,
    })
    gpgpuRef.current = gpgpu
    ;(gpgpu.uniforms.velocityUniforms.uMouseActive as { value: number }).value = 0

    return () => {
      scene.remove(group)
      gpgpu.mesh.geometry.dispose()
      gpgpu.material.dispose()
      gpgpuRef.current = null
      groupRef.current = null
    }
  }, [scene, camera, gl])

  useFrame(() => {
    const gpgpu = gpgpuRef.current
    const group = groupRef.current
    if (!gpgpu || !group) return
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    group.position.copy(camera.position).add(dir.multiplyScalar(DISTANCE_IN_FRONT))
    group.position.y += BAR_Y_OFFSET
    group.updateMatrixWorld(true)
    const t = performance.now() * 0.001
    const uTime = gpgpu.uniforms.velocityUniforms.uTime as { value: number }
    if (uTime) uTime.value = t
    gpgpu.material.uniforms.uIdleTime.value = t
    gpgpu.compute()
    gpgpu.material.uniforms.uPositionTexture.value =
      gpgpu.gpgpuCompute.getCurrentRenderTarget(gpgpu.positionVariable).texture
    gpgpu.material.uniforms.uVelocityTexture.value =
      gpgpu.gpgpuCompute.getCurrentRenderTarget(gpgpu.velocityVariable).texture
    ;(gpgpu.material.uniforms.uProgress as { value: number }).value = Math.min(
      1,
      Math.max(0, progress / 100)
    )
    invalidate()
  }, 0)

  return null
}
