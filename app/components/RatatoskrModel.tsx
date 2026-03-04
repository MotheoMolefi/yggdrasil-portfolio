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
  responseCount?: number
}

const PERCH_POSITION: [number, number, number] = [-400, 1775, 250]
const PERCH_ROTATION_Y = -Math.PI * 0.15 + (30 * Math.PI / 180)

export default function RatatoskrModel({ chatOpen, responseCount = 0 }: RatatoskrModelProps) {
  const group = useRef<THREE.Group>(null!)
  const { camera } = useThree()
  const { scene, animations } = useGLTF('/Ratatoskr.glb') as unknown as GLTFResult
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { nodes, materials } = useGraph(clone) as unknown as GLTFResult
  const { actions } = useAnimations(animations, group)

  const glowIntensity = useRef(0)
  const currentRotY = useRef(PERCH_ROTATION_Y)
  // Mirror chatOpen into a ref so async callbacks can read the latest value
  const chatOpenRef = useRef(chatOpen)
  useEffect(() => { chatOpenRef.current = chatOpen }, [chatOpen])
  // Generation token — incremented whenever a new special animation takes over.
  // Each callback captures its own token; stale callbacks bail out when tokens don't match.
  const animToken = useRef(0)
  // Tracks which special is currently "in charge" so smell never starts during jump.
  const activeSpecial = useRef<'none' | 'jump' | 'smell'>('none')

  // Jump on chat open, return to idle when done
  useEffect(() => {
    const idle = actions['Armature|Squirrel_A13_Idle']
    const jump = actions['Armature|Squirrel_A13_Jump']
    const smell = actions['Armature|Squirrel_A13_Smell']
    if (!idle) return

    if (chatOpen && jump) {
      // Cancel any active smell immediately
      if (activeSpecial.current === 'smell' && smell) smell.fadeOut(0.2)
      activeSpecial.current = 'jump'
      animToken.current++
      const token = animToken.current

      jump.reset().setLoop(THREE.LoopOnce, 1)
      jump.clampWhenFinished = true
      jump.fadeIn(0.3).play()
      idle.fadeOut(0.3)
      const duration = jump.getClip().duration * 1000
      const t = setTimeout(() => {
        if (animToken.current !== token) return
        idle.reset().fadeIn(0.5).play()
        jump.fadeOut(0.5)
        activeSpecial.current = 'none'
      }, duration - 300)
      return () => clearTimeout(t)
    } else {
      if (jump) jump.fadeOut(0.3)
      idle.reset().fadeIn(0.3).play()
      activeSpecial.current = 'none'
    }
  }, [chatOpen, actions])

  // Random smell while idle (chat closed) — every 8–20 seconds
  useEffect(() => {
    if (chatOpen) return
    const smell = actions['Armature|Squirrel_A13_Smell']
    const idle = actions['Armature|Squirrel_A13_Idle']
    if (!smell || !idle) return

    let scheduleTimer: ReturnType<typeof setTimeout>

    const playSmell = () => {
      if (chatOpenRef.current || activeSpecial.current !== 'none') {
        scheduleNext()
        return
      }
      activeSpecial.current = 'smell'
      animToken.current++
      const token = animToken.current

      smell.reset().setLoop(THREE.LoopOnce, 1)
      smell.clampWhenFinished = true
      smell.fadeIn(0.3).play()
      idle.fadeOut(0.3)
      const duration = smell.getClip().duration * 1000
      setTimeout(() => {
        if (animToken.current !== token) return
        if (!chatOpenRef.current) {
          idle.reset().fadeIn(0.5).play()
          smell.fadeOut(0.5)
        }
        activeSpecial.current = 'none'
        scheduleNext()
      }, duration - 300)
    }

    const scheduleNext = () => {
      const delay = 8000 + Math.random() * 12000
      scheduleTimer = setTimeout(playSmell, delay)
    }

    scheduleNext()
    return () => clearTimeout(scheduleTimer)
  }, [chatOpen, actions])

  // Occasionally smell between chat responses (40% chance)
  useEffect(() => {
    if (responseCount === 0) return
    if (Math.random() > 0.4) return
    const smell = actions['Armature|Squirrel_A13_Smell']
    const idle = actions['Armature|Squirrel_A13_Idle']
    if (!smell || !idle || activeSpecial.current !== 'none') return

    activeSpecial.current = 'smell'
    animToken.current++
    const token = animToken.current
    const duration = smell.getClip().duration * 1000

    const t = setTimeout(() => {
      if (animToken.current !== token) {
        activeSpecial.current = 'none'
        return
      }
      smell.reset().setLoop(THREE.LoopOnce, 1)
      smell.clampWhenFinished = true
      smell.fadeIn(0.3).play()
      idle.fadeOut(0.3)
      setTimeout(() => {
        if (animToken.current !== token) return
        idle.reset().fadeIn(0.5).play()
        smell.fadeOut(0.5)
        activeSpecial.current = 'none'
      }, duration - 300)
    }, 600)

    return () => {
      clearTimeout(t)
      if (animToken.current === token) activeSpecial.current = 'none'
    }
  }, [responseCount, actions])

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
