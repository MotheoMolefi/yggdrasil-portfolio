/**
 * Codrops Dreamy Particles — surface sampling for GPGPU (from codrops-dreamy-particles-main)
 * Uses MeshSurfaceSampler for even distribution over the mesh surface.
 */

import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'

export interface SampledData {
  positions: Float32Array
  uvs: Float32Array
  brightnessScale: Float32Array
}

export default class GPGPUUtils {
  size: number
  number: number
  mesh: THREE.Mesh
  sampler!: ReturnType<MeshSurfaceSampler['build']>
  positions!: Float32Array
  positionTexture!: THREE.DataTexture
  uvs!: Float32Array
  velocityTexture!: THREE.DataTexture
  brightnessScale?: Float32Array
  _position: THREE.Vector3

  constructor(
    mesh: THREE.Mesh,
    size: number,
    sampledData?: SampledData
  ) {
    this.size = size
    this.number = size * size
    this.mesh = mesh
    this._position = new THREE.Vector3()

    if (sampledData) {
      this.setupDataFromSampled(sampledData)
    } else {
      this.sampler = new MeshSurfaceSampler(mesh).build()
      this.setupDataFromMesh()
    }
    this.setupVelocitiesData()
  }

  setupDataFromSampled(sampled: SampledData) {
    const data = new Float32Array(4 * this.number)
    for (let i = 0; i < this.number; i++) {
      data[4 * i] = sampled.positions[3 * i]
      data[4 * i + 1] = sampled.positions[3 * i + 1]
      data[4 * i + 2] = sampled.positions[3 * i + 2]
      data[4 * i + 3] = 1
    }
    this.positionTexture = new THREE.DataTexture(
      data,
      this.size,
      this.size,
      THREE.RGBAFormat,
      THREE.FloatType
    )
    this.positionTexture.needsUpdate = true
    this.positions = sampled.positions
    this.uvs = sampled.uvs
    this.brightnessScale = sampled.brightnessScale
  }

  setupDataFromMesh() {
    const data = new Float32Array(4 * this.number)
    const positions = new Float32Array(3 * this.number)
    const uvs = new Float32Array(2 * this.number)

    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const index = i * this.size + j
        this.sampler.sample(this._position)

        data[4 * index] = this._position.x
        data[4 * index + 1] = this._position.y
        data[4 * index + 2] = this._position.z

        positions[3 * index] = this._position.x
        positions[3 * index + 1] = this._position.y
        positions[3 * index + 2] = this._position.z

        uvs[2 * index] = j / (this.size - 1)
        uvs[2 * index + 1] = i / (this.size - 1)
      }
    }

    this.positionTexture = new THREE.DataTexture(
      data,
      this.size,
      this.size,
      THREE.RGBAFormat,
      THREE.FloatType
    )
    this.positionTexture.needsUpdate = true
    this.positions = positions
    this.uvs = uvs
    this.brightnessScale = new Float32Array(this.number)
    this.brightnessScale.fill(1)
  }

  setupVelocitiesData() {
    const data = new Float32Array(4 * this.number)
    data.fill(0)
    this.velocityTexture = new THREE.DataTexture(
      data,
      this.size,
      this.size,
      THREE.RGBAFormat,
      THREE.FloatType
    )
    this.velocityTexture.needsUpdate = true
  }

  getPositions() {
    return this.positions
  }

  getUVs() {
    return this.uvs
  }

  getPositionTexture() {
    return this.positionTexture
  }

  getVelocityTexture() {
    return this.velocityTexture
  }

  getBrightnessScale(): Float32Array | undefined {
    return this.brightnessScale
  }
}
