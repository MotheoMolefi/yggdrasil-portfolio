'use client'

import { useRef, useEffect, useMemo } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useFrame, useGraph, useThree } from '@react-three/fiber'
import { SkeletonUtils, GLTF } from 'three-stdlib'
import * as THREE from 'three'

type ActionName =
  | 'Armature|Squirrel_A13_Idle'
  | 'Armature|Squirrel_A13_Walk'
  | 'Armature|Squirrel_A13_Run'
  | 'Armature|Squirrel_A13_Jump'
  | 'Armature|Squirrel_A13_Eat'
  | 'Armature|Squirrel_A13_Smell'

type GLTFResult = GLTF & {
  nodes: {
    Squirrel_VA: THREE.SkinnedMesh
    RL_BoneRoot: THREE.Bone
  }
  materials: {
    Squirrel_A3: THREE.MeshStandardMaterial
  }
  animations: (THREE.AnimationClip & { name: ActionName })[]
}

interface RatatoskrModelProps {
  chatOpen: boolean
}

const PERCH_POSITION: [number, number, number] = [-400, 1775, 250]
const PERCH_ROTATION_Y = -Math.PI * 0.15 + (30 * Math.PI / 180)

export default function RatatoskrModel({ chatOpen }: RatatoskrModelProps) {
  const group = useRef<THREE.Group>(null!)
  const { camera } = useThree()
  const { scene, animations } = useGLTF('/Ratatoskr.glb') as unknown as GLTFResult
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { nodes, materials } = useGraph(clone) as unknown as GLTFResult
  const { actions } = useAnimations(animations, group)

  const glowIntensity = useRef(0)
  const currentRotY = useRef(PERCH_ROTATION_Y)

  useEffect(() => {
    const idle = actions['Armature|Squirrel_A13_Idle']
    const jump = actions['Armature|Squirrel_A13_Jump']
    if (!idle) return

    if (chatOpen && jump) {
      jump.reset().setLoop(THREE.LoopOnce, 1)
      jump.clampWhenFinished = true
      jump.fadeIn(0.3).play()
      idle.fadeOut(0.3)
      const duration = jump.getClip().duration * 1000
      const t = setTimeout(() => {
        idle.reset().fadeIn(0.5).play()
        jump.fadeOut(0.5)
      }, duration - 300)
      return () => clearTimeout(t)
    } else {
      if (jump) jump.fadeOut(0.3)
      idle.reset().fadeIn(0.3).play()
    }
  }, [chatOpen, actions])

  useEffect(() => {
    if (!materials.Squirrel_A3) return
    materials.Squirrel_A3.transparent = false
    materials.Squirrel_A3.opacity = 1
    materials.Squirrel_A3.depthWrite = true
    materials.Squirrel_A3.emissive = new THREE.Color('#ffcc88')
    materials.Squirrel_A3.needsUpdate = true
  }, [materials])

  useFrame(() => {
    if (!group.current) return

    if (chatOpen) {
      const dx = camera.position.x - PERCH_POSITION[0]
      const dz = camera.position.z - PERCH_POSITION[2]
      currentRotY.current += (Math.atan2(dx, dz) - currentRotY.current) * 0.06
    } else {
      currentRotY.current += (PERCH_ROTATION_Y - currentRotY.current) * 0.06
    }
    group.current.rotation.y = currentRotY.current

    const target = chatOpen ? 0.6 : 0.1
    glowIntensity.current += (target - glowIntensity.current) * 0.05
    if (materials.Squirrel_A3) {
      materials.Squirrel_A3.emissiveIntensity = glowIntensity.current
    }
  })

  return (
    <group
      ref={group}
      position={PERCH_POSITION}
      rotation={[0, PERCH_ROTATION_Y, 0]}
      scale={4.5}
      dispose={null}
    >
      <primitive object={nodes.RL_BoneRoot} />
      <skinnedMesh
        name="Squirrel_VA"
        geometry={nodes.Squirrel_VA.geometry}
        material={materials.Squirrel_A3}
        skeleton={nodes.Squirrel_VA.skeleton}
        castShadow
      />
    </group>
  )
}

useGLTF.preload('/Ratatoskr.glb')
