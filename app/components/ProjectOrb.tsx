'use client'

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Project } from '../data/projects'

const ORB_RADIUS = 50
const BOB_SPEED = 1.0
const BOB_AMPLITUDE = 25
const ROTATION_SPEED = 0.3

export default function ProjectOrb({
  project,
  isActive,
  isViewing,
}: {
  project: Project
  isActive: boolean
  isViewing: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null)
  const { camera } = useThree()
  const baseY = project.position[1]

  useFrame(({ clock }) => {
    const mesh = meshRef.current
    const mat = materialRef.current
    if (!mesh || !mat) return

    const t = clock.getElapsedTime()

    // Gentle bob
    mesh.position.y = baseY + Math.sin(t * BOB_SPEED) * BOB_AMPLITUDE

    // Slow rotation
    mesh.rotation.y = t * ROTATION_SPEED
    mesh.rotation.x = Math.sin(t * 0.2) * 0.1

    // Proximity glow: brighter when active
    const targetIntensity = isActive ? 2.0 : 0.6
    mat.emissiveIntensity += (targetIntensity - mat.emissiveIntensity) * 0.05

    // Extra pulse when active
    if (isActive && !isViewing) {
      mat.emissiveIntensity = 2.5 + Math.sin(t * 3) * 0.5
    }
  })

  return (
    <group>
      <mesh
        ref={meshRef}
        position={project.position}
      >
        <icosahedronGeometry args={[ORB_RADIUS, 1]} />
        <meshPhysicalMaterial
          ref={materialRef}
          color={project.color}
          emissive={new THREE.Color(project.color)}
          emissiveIntensity={0.6}
          metalness={0.25}
          roughness={0.3}
          transparent
          opacity={0.8}
          envMapIntensity={0.8}
          clearcoat={0.5}
          clearcoatRoughness={0.25}
        />

        {/* Floating "Press E" prompt */}
        {isActive && !isViewing && (
          <Html
            center
            distanceFactor={200}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <div style={{
              background: 'rgba(0, 0, 0, 0.15)',
              color: 'white',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(4px)',
              border: `1px solid ${project.color}40`,
            }}>
              Press <span style={{ color: project.color, fontWeight: 700 }}>E</span> to inspect
            </div>
          </Html>
        )}
      </mesh>
    </group>
  )
}
