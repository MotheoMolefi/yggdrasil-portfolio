'use client'

import { useEffect, useRef, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'

const GOLD = new THREE.Color(0.808, 0.647, 0.239)
const AMBER = new THREE.Color(1.0, 0.75, 0.0)

export default function YggdrasilText() {
  const groupRef = useRef<THREE.Group>(null!)
  const textRef = useRef<THREE.Mesh>(null!)
  const edgeGlowRef = useRef<THREE.Mesh>(null!)
  const mainLightRef = useRef<THREE.PointLight>(null!)
  const fillLightRef = useRef<THREE.PointLight>(null!)
  const particlesRef = useRef<THREE.Points>(null!)
  const burstParticlesRef = useRef<THREE.Points[]>([])
  const { scene, camera } = useThree()
  const [fontLoaded, setFontLoaded] = useState(false)
  const samplerRef = useRef<MeshSurfaceSampler | null>(null)
  const mouseRef = useRef(new THREE.Vector2(0, 0))
  const targetPosRef = useRef(new THREE.Vector3(0, 0, 0))
  const isHoveredRef = useRef(false)
  const lastBurstTime = useRef(0)
  const particlePositions = useRef<Float32Array | null>(null)
  const particleVelocities = useRef<Float32Array | null>(null)
  const particleLifetimes = useRef<Float32Array | null>(null)

  useEffect(() => {
    const loader = new FontLoader()
    loader.load(
      '/norse_font/Norsebold.json',
      (font) => {
        const textGeo = new TextGeometry('YGGDRASIL', {
          font: font as any,
          size: 300,
          height: 60,
          curveSegments: 12,
          bevelEnabled: true,
          bevelThickness: 8,
          bevelSize: 4,
          bevelSegments: 5,
        })

        textGeo.computeBoundingBox()
        const bbox = textGeo.boundingBox!
        const center = new THREE.Vector3()
        bbox.getCenter(center)
        textGeo.translate(-center.x, -center.y, -center.z)

        if (textRef.current) {
          textRef.current.geometry = textGeo
          textRef.current.visible = true

          const glowGeo = textGeo.clone()
          glowGeo.scale(1.05, 1.05, 1.05)
          if (edgeGlowRef.current) {
            edgeGlowRef.current.geometry = glowGeo
            edgeGlowRef.current.visible = true
          }

          const tempMesh = new THREE.Mesh(textGeo)
          const sampler = new MeshSurfaceSampler(tempMesh)
          sampler.build()
          samplerRef.current = sampler

          createParticles()
        }

        setFontLoaded(true)
      },
      undefined,
      (err) => {
        console.error('Font load error:', err)
      }
    )

    const handleMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = -(e.clientY / window.innerHeight) * 2 + 1
      mouseRef.current.set(nx, ny)
      
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouseRef.current, camera)
      if (textRef.current) {
        const intersects = raycaster.intersectObject(textRef.current, true)
        isHoveredRef.current = intersects.length > 0
      }
    }

    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [camera])

  const createParticles = () => {
    if (!samplerRef.current) return

    const particleCount = 8000
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)
    const offsets = new Float32Array(particleCount)
    const tempPosition = new THREE.Vector3()
    const tempNormal = new THREE.Vector3()

    for (let i = 0; i < particleCount; i++) {
      samplerRef.current.sample(tempPosition, tempNormal)
      positions[i * 3] = tempPosition.x
      positions[i * 3 + 1] = tempPosition.y
      positions[i * 3 + 2] = tempPosition.z

      const brightness = 0.7 + Math.random() * 0.3
      colors[i * 3] = GOLD.r * brightness
      colors[i * 3 + 1] = GOLD.g * brightness
      colors[i * 3 + 2] = GOLD.b * brightness

      sizes[i] = 12 + Math.random() * 12
      offsets[i] = Math.random() * Math.PI * 2
    }

    particlePositions.current = positions
    particleVelocities.current = new Float32Array(particleCount * 3)
    particleLifetimes.current = new Float32Array(particleCount)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('offset', new THREE.BufferAttribute(offsets, 1))

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        isHovered: { value: 0.0 },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        attribute float offset;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float time;
        uniform float isHovered;
        void main() {
          vColor = color;
          vec3 pos = position;
          float t = time * 0.3 + offset;
          
          float flowForce = 1.0 + isHovered * 2.0;
          pos.x += sin(pos.y * 0.008 + t) * (15.0 * flowForce);
          pos.z += cos(pos.x * 0.008 + t) * (15.0 * flowForce);
          pos.y += sin(pos.z * 0.005 + t) * (8.0 * flowForce);
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          float dist = length(mvPosition.xyz);
          float pointSize = size * (1500.0 / -mvPosition.z);
          if (isHovered > 0.5) {
            pointSize *= 1.5;
          }
          gl_PointSize = pointSize;
          
          float trailAlpha = 1.0;
          if (dist > 3000.0) {
            trailAlpha = max(0.0, 1.0 - (dist - 3000.0) / 1000.0);
          }
          vAlpha = 0.8 * trailAlpha;
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          if (dist > 0.5) discard;
          
          float alpha = vAlpha * (1.0 - smoothstep(0.1, 0.5, dist));
          
          vec2 dir = normalize(center);
          float glow = exp(-dist * 4.0);
          vec3 finalColor = vColor + vColor * glow * 0.5;
          
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    if (particlesRef.current) {
      particlesRef.current.geometry.dispose()
      ;(particlesRef.current.material as THREE.ShaderMaterial).dispose()
    }

    const particles = new THREE.Points(geometry, material)
    if (groupRef.current) {
      groupRef.current.add(particles)
    }
    particlesRef.current = particles
  }

  const createBurst = () => {
    if (!samplerRef.current || !groupRef.current) return

    const burstCount = 300
    const tempPosition = new THREE.Vector3()
    const tempNormal = new THREE.Vector3()
    
    for (let i = 0; i < 3; i++) {
      samplerRef.current.sample(tempPosition, tempNormal)
      
      if (Math.random() > 0.5) {
        tempNormal.multiplyScalar(-1)
      }

      const positions = new Float32Array(burstCount * 3)
      const velocities = new Float32Array(burstCount * 3)
      const colors = new Float32Array(burstCount * 3)
      const lifetimes = new Float32Array(burstCount)

      for (let j = 0; j < burstCount; j++) {
        positions[j * 3] = tempPosition.x + (Math.random() - 0.5) * 20
        positions[j * 3 + 1] = tempPosition.y + (Math.random() - 0.5) * 20
        positions[j * 3 + 2] = tempPosition.z + (Math.random() - 0.5) * 20

        const spread = 0.8 + Math.random() * 1.2
        velocities[j * 3] = (tempNormal.x + (Math.random() - 0.5) * spread) * (30 + Math.random() * 50)
        velocities[j * 3 + 1] = (tempNormal.y + (Math.random() - 0.5) * spread) * (30 + Math.random() * 50)
        velocities[j * 3 + 2] = (tempNormal.z + (Math.random() - 0.5) * spread) * (30 + Math.random() * 50)

        const brightness = 0.8 + Math.random() * 0.4
        const useAmber = Math.random() > 0.7
        colors[j * 3] = useAmber ? AMBER.r * brightness : GOLD.r * brightness
        colors[j * 3 + 1] = useAmber ? AMBER.g * brightness : GOLD.g * brightness
        colors[j * 3 + 2] = useAmber ? AMBER.b * brightness : GOLD.b * brightness

        lifetimes[j] = 1.5 + Math.random() * 1.0
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3))
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1))

      const material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          startTime: { value: performance.now() * 0.001 },
        },
        vertexShader: `
          attribute vec3 velocity;
          attribute vec3 color;
          attribute float lifetime;
          varying vec3 vColor;
          varying float vLife;
          uniform float time;
          uniform float startTime;
          void main() {
            vColor = color;
            float elapsed = time - startTime;
            vLife = 1.0 - (elapsed / lifetime);
            if (vLife < 0.0) vLife = 0.0;
            vec3 pos = position + velocity * elapsed * 0.1;
            pos.y += elapsed * elapsed * 5.0;
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = (15.0 + sin(elapsed * 20.0) * 5.0) * (1200.0 / -mvPosition.z) * vLife;
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vLife;
          void main() {
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;
            float alpha = vLife * (1.0 - smoothstep(0.0, 0.5, dist));
            vec3 glowColor = vColor * (1.0 + vLife * 2.0);
            gl_FragColor = vec4(glowColor, alpha * 0.9);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })

      const burst = new THREE.Points(geometry, material)
      ;(burst as any).startTime = performance.now() * 0.001
      groupRef.current.add(burst)
      burstParticlesRef.current.push(burst)

      setTimeout(() => {
        if (groupRef.current && burst.parent) {
          groupRef.current.remove(burst)
          geometry.dispose()
          material.dispose()
        }
      }, 3000)
    }
  }

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()

    if (mainLightRef.current) {
      const orbitRadius = 1200
      const orbitHeight = 1200
      const angle = time * 0.1
      mainLightRef.current.position.x = Math.sin(angle) * orbitRadius
      mainLightRef.current.position.z = Math.cos(angle) * orbitRadius
      mainLightRef.current.position.y = orbitHeight
    }

    if (fillLightRef.current) {
      const angle = time * 0.08 + Math.PI
      fillLightRef.current.position.x = Math.sin(angle) * 800
      fillLightRef.current.position.z = Math.cos(angle) * 800
      fillLightRef.current.position.y = 600 + Math.sin(time * 0.2) * 200
    }

    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(time * 0.05) * 0.15
    }

    if (isHoveredRef.current) {
      targetPosRef.current.x += mouseRef.current.x * 80
      targetPosRef.current.y += mouseRef.current.y * 80
    } else {
      targetPosRef.current.x *= 0.92
      targetPosRef.current.y *= 0.92
    }

    if (textRef.current) {
      textRef.current.position.x += (targetPosRef.current.x - textRef.current.position.x) * 0.08
      textRef.current.position.y += (targetPosRef.current.y - textRef.current.position.y) * 0.08
    }

    if (edgeGlowRef.current) {
      edgeGlowRef.current.position.copy(textRef.current.position)
      const glowMat = edgeGlowRef.current.material as THREE.ShaderMaterial
      glowMat.uniforms.time.value = time
      glowMat.uniforms.isHovered.value = isHoveredRef.current ? 1.0 : 0.0
    }

    if (particlesRef.current) {
      particlesRef.current.position.copy(textRef.current.position)
      particlesRef.current.rotation.y = Math.sin(time * 0.05) * 0.15
      const mat = particlesRef.current.material as THREE.ShaderMaterial
      mat.uniforms.time.value = time
      mat.uniforms.isHovered.value = isHoveredRef.current ? 1.0 : 0.0
    }

    burstParticlesRef.current.forEach((burst) => {
      const mat = burst.material as THREE.ShaderMaterial
      mat.uniforms.time.value = time
    })

    if (time - lastBurstTime.current > 2 + Math.random() * 1) {
      createBurst()
      lastBurstTime.current = time
    }
  })

  return (
    <group ref={groupRef} position={[0, 1500, 0]}>
      <mesh ref={textRef} visible={false} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#1a1a2e"
          metalness={1.0}
          roughness={0.05}
          envMapIntensity={3.0}
          emissive="#0f0f1f"
          emissiveIntensity={2.0}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
          reflectivity={1.0}
        />
      </mesh>

      <mesh ref={edgeGlowRef} visible={false}>
        <shaderMaterial
          uniforms={{
            time: { value: 0 },
            isHovered: { value: 0.0 },
          }}
          vertexShader={`
            varying vec3 vPosition;
            varying vec3 vNormal;
            void main() {
              vPosition = position;
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float time;
            uniform float isHovered;
            varying vec3 vPosition;
            varying vec3 vNormal;
            void main() {
              vec3 viewDir = normalize(cameraPosition - vPosition);
              float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.0);
              float pulse = sin(time * 2.0) * 0.3 + 0.7;
              float intensity = fresnel * pulse * (1.0 + isHovered * 0.5);
              vec3 glowColor = mix(vec3(0.3, 0.5, 1.0), vec3(0.8, 0.6, 0.2), fresnel);
              gl_FragColor = vec4(glowColor, intensity * 0.8);
            }
          `}
          transparent={true}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      <pointLight
        ref={mainLightRef}
        position={[1200, 1200, 0]}
        intensity={8000000}
        color="#ffffff"
        distance={3000}
        decay={2}
        castShadow
      />

      <pointLight
        ref={fillLightRef}
        position={[-800, 600, -800]}
        intensity={3000000}
        color="#ffd700"
        distance={2000}
        decay={2}
      />

      <pointLight
        position={[0, 400, 0]}
        intensity={1000000}
        color="#66aaff"
        distance={1500}
        decay={2}
      />
    </group>
  )
}
