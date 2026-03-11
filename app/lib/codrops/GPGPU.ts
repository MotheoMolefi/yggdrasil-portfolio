/**
 * Codrops Dreamy Particles — GPGPU particle system (from codrops-dreamy-particles-main).
 * Uses GPUComputationRenderer + MeshSurfaceSampler for position/velocity simulation.
 */

import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js'
import GPGPUUtils from './GPGPUUtils'
import { simFragment, simFragmentVelocity, vertexShader, fragmentShader } from './shaders'

export interface GPGPUParams {
  color: THREE.Color
  size: number
  minAlpha: number
  maxAlpha: number
  force: number
}

export interface GPGPUOptions {
  size: number
  camera: THREE.Camera
  renderer: THREE.WebGLRenderer
  mouse: { cursorPosition: THREE.Vector3 }
  /** Scene or Group to add the points mesh to (e.g. a Group that moves with the camera). */
  scene: THREE.Scene | THREE.Group
  model: THREE.Mesh
  sizes: { width: number; height: number }
  debug?: unknown
  params: GPGPUParams
  /** If not provided, compute() only runs the GPU simulation (no mouse events). Caller can set velocityUniforms.uMouse / uMouseSpeed manually. */
  events?: { update: () => void }
}

export default class GPGPU {
  camera: THREE.Camera
  renderer: THREE.WebGLRenderer
  mouse: { cursorPosition: THREE.Vector3 }
  scene: THREE.Scene | THREE.Group
  model: THREE.Mesh
  sizes: { width: number; height: number }
  size: number
  params: GPGPUParams
  utils!: GPGPUUtils
  gpgpuCompute!: GPUComputationRenderer
  positionVariable!: ReturnType<GPUComputationRenderer['addVariable']>
  velocityVariable!: ReturnType<GPUComputationRenderer['addVariable']>
  uniforms!: {
    positionUniforms: Record<string, { value: unknown }>
    velocityUniforms: Record<string, { value: unknown }>
  }
  material!: THREE.ShaderMaterial
  mesh!: THREE.Points
  events: { update: () => void }

  constructor(options: GPGPUOptions) {
    this.camera = options.camera
    this.renderer = options.renderer
    this.mouse = options.mouse
    this.scene = options.scene
    this.model = options.model
    this.sizes = options.sizes
    this.size = options.size
    this.params = options.params
    this.events = options.events ?? { update: () => {} }
    this.init()
  }

  init() {
    this.utils = new GPGPUUtils(this.model, this.size)
    this.initGPGPU()
    this.createParticles()
  }

  initGPGPU() {
    // Computation resolution must match particle grid (size × size), not canvas size
    this.gpgpuCompute = new GPUComputationRenderer(
      this.size,
      this.size,
      this.renderer
    )

    const positionTexture = this.utils.getPositionTexture()
    const velocityTexture = this.utils.getVelocityTexture()

    this.positionVariable = this.gpgpuCompute.addVariable(
      'uCurrentPosition',
      simFragment,
      positionTexture
    )
    this.velocityVariable = this.gpgpuCompute.addVariable(
      'uCurrentVelocity',
      simFragmentVelocity,
      velocityTexture
    )

    this.gpgpuCompute.setVariableDependencies(this.positionVariable, [
      this.positionVariable,
      this.velocityVariable,
    ])
    this.gpgpuCompute.setVariableDependencies(this.velocityVariable, [
      this.positionVariable,
      this.velocityVariable,
    ])

    this.uniforms = {
      positionUniforms: this.positionVariable.material.uniforms as Record<string, { value: unknown }>,
      velocityUniforms: this.velocityVariable.material.uniforms as Record<string, { value: unknown }>,
    }

    this.uniforms.velocityUniforms.uMouse = { value: new THREE.Vector3(1e6, 1e6, 1e6) }
    this.uniforms.velocityUniforms.uMouseSpeed = { value: 0 }
    this.uniforms.velocityUniforms.uMouseActive = { value: 0 }
    this.uniforms.velocityUniforms.uOriginalPosition = { value: positionTexture }
    this.uniforms.velocityUniforms.uTime = { value: 0 }
    this.uniforms.velocityUniforms.uForce = { value: this.params.force }

    const err = this.gpgpuCompute.init()
    if (err !== null) {
      console.error('[GPGPU] init failed:', err)
    }
  }

  createParticles() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uPositionTexture: {
          value: this.gpgpuCompute.getCurrentRenderTarget(this.positionVariable).texture,
        },
        uVelocityTexture: {
          value: this.gpgpuCompute.getCurrentRenderTarget(this.velocityVariable).texture,
        },
        uResolution: { value: new THREE.Vector2(this.sizes.width, this.sizes.height) },
        uParticleSize: { value: this.params.size },
        uColor: { value: this.params.color },
        uMinAlpha: { value: this.params.minAlpha },
        uMaxAlpha: { value: this.params.maxAlpha },
      },
      vertexShader,
      fragmentShader,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      transparent: true,
    })

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.utils.getPositions(), 3)
    )
    geometry.setAttribute('uv', new THREE.BufferAttribute(this.utils.getUVs(), 2))

    this.mesh = new THREE.Points(geometry, this.material)
    this.scene.add(this.mesh)
  }

  compute() {
    this.gpgpuCompute.compute()
    this.events.update()
  }
}
