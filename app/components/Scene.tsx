'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Environment } from '@react-three/drei'
import { useEffect, useRef, useState, useCallback } from 'react'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import * as THREE from 'three'
import ProjectOrb from './ProjectOrb'
import ProjectPanel from './ProjectPanel'
import RatatoskrModel from './RatatoskrModel'
import RatatoskrChat from './RatatoskrChat'
import { projects } from '../data/projects'
import type { PresetsType } from '@react-three/drei/helpers/environment-assets'

// ============================================================================
// CINEMATIC CAMERA CONTROLLER
// Custom fly/free camera with smooth movement and mouse-based look controls
// ============================================================================
function CinematicCamera({
  moveSpeed = 0.08,         // How fast WASD moves the camera
  friction = 0.95,          // How quickly momentum decays (0.95 = gentle drift, 0.8 = quick stop)
  lookSensitivity = 1.5,    // How fast mouse controls camera direction
  deadZone = 0.1,           // Radius in screen center where mouse has no effect
  startupDelay = 1000,      // Milliseconds before mouse control activates
  minHeight = 0.5,          // Floor - camera can't go below this Y
  maxHeight = 1,            // Ceiling - camera can't go above this Y
  maxDistance = 20,         // Maximum distance from tree center
  treeCenter = new THREE.Vector3(0, 5, 0),  // Center point of the tree (for boundary)
  locked = false,           // When true, all movement/look is disabled (for orb zoom)
  zoomTarget,               // World-space position to fly toward when locked
  onInteract,               // Called when E is pressed
  onExit,                   // Called when Escape is pressed
  onZoomComplete,           // Called when camera reaches the orb
}: {
  moveSpeed?: number
  friction?: number
  lookSensitivity?: number
  deadZone?: number
  startupDelay?: number
  minHeight?: number
  maxHeight?: number
  maxDistance?: number
  treeCenter?: THREE.Vector3
  locked?: boolean
  zoomTarget?: [number, number, number] | null
  onInteract?: () => void
  onExit?: () => void
  onZoomComplete?: () => void
}) {
  const { camera, gl, size } = useThree()
  
  // Refs for tracking state across frames
  const keys = useRef<Set<string>>(new Set())           // Currently pressed keys
  const velocity = useRef(new THREE.Vector3(0, 0, 0))   // Current movement velocity
  const mouseX = useRef(0)                              // Mouse X position (-1 to 1)
  const mouseY = useRef(0)                              // Mouse Y position (-1 to 1)
  const currentYaw = useRef(0)                          // Accumulated yaw (left/right rotation)
  const currentPitch = useRef(0)                        // Accumulated pitch (up/down rotation)
  const currentYawSpeed = useRef(0)                     // Smoothed yaw turn speed
  const currentPitchSpeed = useRef(0)                   // Smoothed pitch turn speed
  const mouseControlReady = useRef(false)               // Whether mouse controls are active
  const delayTimerStarted = useRef(false)               // Whether delay timer has started
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null)  // Timer reference for cleanup

  // Zoom fly-to state
  const savedPosition = useRef(new THREE.Vector3())     // Camera position before zoom
  const savedYaw = useRef(0)                            // Yaw before zoom
  const savedPitch = useRef(0)                          // Pitch before zoom
  const zoomProgress = useRef(0)                        // 0 = at saved pos, 1 = at orb
  const isZooming = useRef<'in' | 'out' | null>(null)  // Current zoom direction
  const zoomCompleted = useRef(false)                   // Whether we've fired onZoomComplete

  const FREE_ROAM_START = new THREE.Vector3(0, 1200, 2200)
  const FREE_ROAM_LOOK = new THREE.Vector3(0, 1500, 0)

  // Intro lerp (only when coming from guided mode, not initial load)
  const introLerping = useRef(false)
  const introProgress = useRef(0)
  const introStartPos = useRef(new THREE.Vector3())
  const introStartLook = useRef(new THREE.Vector3())

  useEffect(() => {
    const dist = camera.position.distanceTo(FREE_ROAM_START)
    if (dist > 50) {
      introStartPos.current.copy(camera.position)
      const dir = new THREE.Vector3()
      camera.getWorldDirection(dir)
      introStartLook.current.copy(camera.position).add(dir.multiplyScalar(500))
      introProgress.current = 0
      introLerping.current = true
    } else {
      camera.position.copy(FREE_ROAM_START)
      camera.rotation.order = 'YXZ'
      camera.lookAt(FREE_ROAM_LOOK)
      currentYaw.current = camera.rotation.y
      currentPitch.current = camera.rotation.x
      introLerping.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const canvas = gl.domElement

    // ========== KEYBOARD HANDLERS ==========
    // Ignore keys when Cmd/Ctrl is pressed (allows system shortcuts like screenshots)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return
      keys.current.add(e.code)
      // Prevent default for navigation keys to avoid page scroll
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault()
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code)

    // ========== MOUSE MOVE HANDLER ==========
    // Starts delay timer on first mouse activity, then tracks position
    const handleMouseMove = (e: MouseEvent) => {
      // Start delay timer on first mouse activity (handles cursor already on screen)
      if (!delayTimerStarted.current) {
        delayTimerStarted.current = true
        delayTimerRef.current = setTimeout(() => {
          mouseControlReady.current = true
        }, startupDelay)
      }
      
      // Don't track mouse until controls are ready
      if (!mouseControlReady.current) return
      
      // Absolute position: -1 (left/top) to +1 (right/bottom), 0 = screen center
      mouseX.current = (e.clientX / size.width) * 2 - 1
      mouseY.current = (e.clientY / size.height) * 2 - 1
    }

    // ========== MOUSE LEAVE/ENTER HANDLERS ==========
    // Reset to neutral when mouse leaves, prevents stuck turning
    const handleMouseLeave = () => {
      mouseX.current = 0
      mouseY.current = 0
    }

    // Start timer when mouse enters (if not already started)
    const handleMouseEnter = (e: MouseEvent) => {
      if (!delayTimerStarted.current) {
        delayTimerStarted.current = true
        delayTimerRef.current = setTimeout(() => {
          mouseControlReady.current = true
        }, startupDelay)
      }
      if (!mouseControlReady.current) return
      mouseX.current = (e.clientX / size.width) * 2 - 1
      mouseY.current = (e.clientY / size.height) * 2 - 1
    }

    // ========== SCROLL HANDLER ==========
    // Scroll wheel controls vertical movement (up/down)
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      velocity.current.y -= e.deltaY * 0.001
    }

    // Fullscreen toggle on Tab key
    const handleFullscreen = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault()
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen()
        } else {
          document.exitFullscreen()
        }
      }
    }

    // Orb interaction keys
    const handleInteractionKeys = (e: KeyboardEvent) => {
      if (e.code === 'KeyE') {
        if (onExit && locked) onExit()
        else if (onInteract) onInteract()
      }
    }

    // Add all event listeners
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('keydown', handleFullscreen)
    window.addEventListener('keydown', handleInteractionKeys)
    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mouseenter', handleMouseEnter)
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    // Cleanup on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('keydown', handleFullscreen)
      window.removeEventListener('keydown', handleInteractionKeys)
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mouseenter', handleMouseEnter)
      canvas.removeEventListener('wheel', handleWheel)
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current)
    }
  }, [gl, size, startupDelay, onInteract, onExit])

  // Kill all momentum when unlocking
  const wasLocked = useRef(false)

  // ========== FRAME UPDATE (runs every frame) ==========
  useFrame(() => {
    // ===== INTRO LERP (smooth transition from guided mode) =====
    if (introLerping.current) {
      introProgress.current = Math.min(1, introProgress.current + 0.004)
      const t = introProgress.current
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

      camera.position.lerpVectors(introStartPos.current, FREE_ROAM_START, ease)
      const look = new THREE.Vector3().lerpVectors(introStartLook.current, FREE_ROAM_LOOK, ease)
      camera.lookAt(look)

      if (introProgress.current >= 1) {
        introLerping.current = false
        camera.rotation.order = 'YXZ'
        currentYaw.current = camera.rotation.y
        currentPitch.current = camera.rotation.x
      }
      return
    }

    // ===== ZOOM FLY-TO / FLY-BACK =====
    if (locked && zoomTarget) {
      if (!wasLocked.current) {
        // Just entered lock — save current state and start zooming in
        savedPosition.current.copy(camera.position)
        savedYaw.current = currentYaw.current
        savedPitch.current = currentPitch.current
        zoomProgress.current = 0
        isZooming.current = 'in'
        zoomCompleted.current = false
        wasLocked.current = true
      }

      const ZOOM_SPEED = 0.003
      const VIEW_DISTANCE = 150

      // Compute the "viewing" position: offset from orb, facing it
      const orbPos = new THREE.Vector3(...zoomTarget)
      const dirToOrb = orbPos.clone().sub(savedPosition.current).normalize()
      const viewPos = orbPos.clone().sub(dirToOrb.multiplyScalar(VIEW_DISTANCE))

      // Compute look-at yaw/pitch toward the orb
      const lookDir = orbPos.clone().sub(viewPos).normalize()
      const targetYaw = Math.atan2(-lookDir.x, -lookDir.z)
      const targetPitch = Math.asin(lookDir.y)

      if (isZooming.current === 'in') {
        zoomProgress.current = Math.min(1, zoomProgress.current + ZOOM_SPEED)

        // Smooth easing (ease-in-out)
        const t = zoomProgress.current
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

        camera.position.lerpVectors(savedPosition.current, viewPos, ease)
        currentYaw.current = savedYaw.current + (targetYaw - savedYaw.current) * ease
        currentPitch.current = savedPitch.current + (targetPitch - savedPitch.current) * ease

        if (zoomProgress.current >= 1 && !zoomCompleted.current) {
          zoomCompleted.current = true
          if (onZoomComplete) onZoomComplete()
        }
      }

      // Apply rotation during zoom
      camera.rotation.order = 'YXZ'
      camera.rotation.y = currentYaw.current
      camera.rotation.x = currentPitch.current
      return
    }

    // ===== ZOOM OUT (returning from orb) =====
    if (!locked && wasLocked.current) {
      if (isZooming.current !== 'out') {
        isZooming.current = 'out'
        zoomProgress.current = 1
      }

      const ZOOM_SPEED = 0.005
      zoomProgress.current = Math.max(0, zoomProgress.current - ZOOM_SPEED)

      const t = zoomProgress.current
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

      if (zoomTarget) {
        const orbPos = new THREE.Vector3(...zoomTarget)
        const dirToOrb = orbPos.clone().sub(savedPosition.current).normalize()
        const viewPos = orbPos.clone().sub(dirToOrb.multiplyScalar(150))

        const lookDir = orbPos.clone().sub(viewPos).normalize()
        const targetYaw = Math.atan2(-lookDir.x, -lookDir.z)
        const targetPitch = Math.asin(lookDir.y)

        camera.position.lerpVectors(savedPosition.current, viewPos, ease)
        currentYaw.current = savedYaw.current + (targetYaw - savedYaw.current) * ease
        currentPitch.current = savedPitch.current + (targetPitch - savedPitch.current) * ease
      }

      camera.rotation.order = 'YXZ'
      camera.rotation.y = currentYaw.current
      camera.rotation.x = currentPitch.current

      if (zoomProgress.current <= 0) {
        wasLocked.current = false
        isZooming.current = null
        velocity.current.set(0, 0, 0)
        keys.current.clear()
      }
      return
    }

    if (!locked && !wasLocked.current && isZooming.current) {
      isZooming.current = null
    }

    const k = keys.current

    // Get camera's forward and right directions (horizontal plane only)
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()

    const right = new THREE.Vector3()
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

    // Build input direction from pressed keys
    const inputDir = new THREE.Vector3(0, 0, 0)

    // WASD / Arrow keys for horizontal movement
    if (k.has('KeyW') || k.has('ArrowUp')) inputDir.add(forward)
    if (k.has('KeyS') || k.has('ArrowDown')) inputDir.add(forward.clone().multiplyScalar(-1))
    if (k.has('KeyA') || k.has('ArrowLeft')) inputDir.add(right.clone().multiplyScalar(-1))
    if (k.has('KeyD') || k.has('ArrowRight')) inputDir.add(right)
    
    // Space = up, F/Shift = down
    if (k.has('Space')) inputDir.y += 1
    if (k.has('KeyF') || k.has('ShiftLeft') || k.has('ShiftRight')) inputDir.y -= 1

    // Apply movement
    if (inputDir.length() > 0) {
      inputDir.normalize().multiplyScalar(moveSpeed)
      velocity.current.copy(inputDir)
    } else {
      // No input - apply friction (drift to stop)
      // Horizontal: floaty astronaut feel
      velocity.current.x *= friction
      velocity.current.z *= friction
      // Vertical: faster drift
      velocity.current.y *= 0.85
    }

    // Apply velocity to camera position
    camera.position.add(velocity.current)

    // ========== BOUNDARY CONSTRAINTS ==========
    // Floor constraint
    if (camera.position.y < minHeight) {
      camera.position.y = minHeight
      velocity.current.y = 0
    }

    // Ceiling constraint
    if (camera.position.y > maxHeight) {
      camera.position.y = maxHeight
      velocity.current.y = 0
    }

    // Distance from tree constraint
    const distanceFromTree = camera.position.distanceTo(treeCenter)
    if (distanceFromTree > maxDistance) {
      const direction = camera.position.clone().sub(treeCenter).normalize()
      camera.position.copy(treeCenter).add(direction.multiplyScalar(maxDistance))
      velocity.current.multiplyScalar(0.5)
    }

    // ========== MOUSE LOOK (only after startup delay) ==========
    if (mouseControlReady.current) {
      // YAW (horizontal turning) - velocity-based accumulation
      let effectiveMouseX = mouseX.current
      if (Math.abs(effectiveMouseX) < deadZone) effectiveMouseX = 0
      else effectiveMouseX = effectiveMouseX - Math.sign(effectiveMouseX) * deadZone

      const targetYawSpeed = -effectiveMouseX * lookSensitivity * 0.012
      currentYawSpeed.current += (targetYawSpeed - currentYawSpeed.current) * 0.04
      currentYaw.current += currentYawSpeed.current

      // PITCH (vertical looking) - velocity-based accumulation
      let effectiveMouseY = mouseY.current
      if (Math.abs(effectiveMouseY) < deadZone) effectiveMouseY = 0
      else effectiveMouseY = effectiveMouseY - Math.sign(effectiveMouseY) * deadZone

      const targetPitchSpeed = -effectiveMouseY * lookSensitivity * 0.007
      currentPitchSpeed.current += (targetPitchSpeed - currentPitchSpeed.current) * 0.04
      currentPitch.current += currentPitchSpeed.current
      
      // Clamp pitch to prevent flipping (~±40°)
      currentPitch.current = Math.max(-0.7, Math.min(0.7, currentPitch.current))
    }

    // Apply rotation (YXZ order for FPS-style rotation)
    camera.rotation.order = 'YXZ'
    camera.rotation.y = currentYaw.current
    camera.rotation.x = currentPitch.current
  })

  return null
}

// ============================================================================
// GUIDED CAMERA CONTROLLER
// Continuous-scroll tour: wheel drives smooth interpolation between waypoints
// ============================================================================
const GUIDED_WAYPOINTS = (() => {
  const overview = {
    position: new THREE.Vector3(0, 1347, 3985),
    lookAt: new THREE.Vector3(-100, 1800, 0),
    projectId: null as string | null,
  }

  const orbStops = projects.map((p) => {
    const orbPos = new THREE.Vector3(...p.position)
    const dirXZ = new THREE.Vector3(orbPos.x, 0, orbPos.z).normalize()
    const camPos = orbPos.clone().add(dirXZ.multiplyScalar(200))
    camPos.y = orbPos.y + 40
    return {
      position: camPos,
      lookAt: orbPos.clone(),
      projectId: p.id,
    }
  })

  return [overview, ...orbStops]
})()

const SCROLL_SENSITIVITY = 0.0008
const SCROLL_LERP_SPEED = 0.04

function GuidedCamera({
  locked = false,
  zoomTarget,
  onInteract,
  onExit,
  onZoomComplete,
  onActiveChange,
  onScrollProgress,
  onReady,
}: {
  locked?: boolean
  zoomTarget?: [number, number, number] | null
  onInteract?: () => void
  onExit?: () => void
  onZoomComplete?: () => void
  onActiveChange?: (id: string | null) => void
  onScrollProgress?: (progress: number, total: number) => void
  onReady?: () => void
}) {
  const { camera, gl } = useThree()

  const scrollTarget = useRef(0)
  const scrollCurrent = useRef(0)
  const lastReportedId = useRef<string | null>(null)

  const introProgress = useRef(0)
  const introStartPos = useRef(new THREE.Vector3())
  const introStartLook = useRef(new THREE.Vector3())
  const introReady = useRef(false)
  const introFired = useRef(false)

  // Zoom fly-to state (same pattern as CinematicCamera)
  const savedPosition = useRef(new THREE.Vector3())
  const savedLookAt = useRef(new THREE.Vector3())
  const zoomProgress = useRef(0)
  const isZooming = useRef<'in' | 'out' | null>(null)
  const zoomCompleted = useRef(false)
  const wasLocked = useRef(false)

  const maxProgress = GUIDED_WAYPOINTS.length - 1

  useEffect(() => {
    const wp = GUIDED_WAYPOINTS[0]
    const dist = camera.position.distanceTo(wp.position)
    if (dist > 100) {
      introStartPos.current.copy(camera.position)
      const lookDir = new THREE.Vector3()
      camera.getWorldDirection(lookDir)
      introStartLook.current.copy(camera.position).add(lookDir.multiplyScalar(500))
      introProgress.current = 0
      introReady.current = false
      introFired.current = false
    } else {
      camera.position.copy(wp.position)
      camera.lookAt(wp.lookAt)
      introReady.current = true
      introFired.current = false
      setTimeout(() => { if (onReady) onReady() }, 2500)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (locked || !introReady.current) return

      scrollTarget.current -= e.deltaY * SCROLL_SENSITIVITY
      scrollTarget.current = Math.max(0, Math.min(maxProgress, scrollTarget.current))
    }

    const handleKeys = (e: KeyboardEvent) => {
      if (e.code === 'KeyE') {
        if (onExit && locked) onExit()
        else if (onInteract) onInteract()
      }
      if (e.code === 'Tab') {
        e.preventDefault()
        if (!document.fullscreenElement) document.documentElement.requestFullscreen()
        else document.exitFullscreen()
      }
    }

    const canvas = gl.domElement
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeys)

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeys)
    }
  }, [gl, locked, onInteract, onExit, maxProgress])

  useFrame(() => {
    // ===== ZOOM FLY-TO (orb inspection) =====
    if (locked && zoomTarget) {
      if (!wasLocked.current) {
        savedPosition.current.copy(camera.position)
        const idx = Math.round(scrollCurrent.current)
        const wp = GUIDED_WAYPOINTS[Math.min(idx, maxProgress)]
        savedLookAt.current.copy(wp.lookAt)
        zoomProgress.current = 0
        isZooming.current = 'in'
        zoomCompleted.current = false
        wasLocked.current = true
      }

      const ZOOM_SPEED = 0.003
      const VIEW_DISTANCE = 150
      const orbPos = new THREE.Vector3(...zoomTarget)
      const dirToOrb = orbPos.clone().sub(savedPosition.current).normalize()
      const viewPos = orbPos.clone().sub(dirToOrb.multiplyScalar(VIEW_DISTANCE))

      if (isZooming.current === 'in') {
        zoomProgress.current = Math.min(1, zoomProgress.current + ZOOM_SPEED)
        const t = zoomProgress.current
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

        camera.position.lerpVectors(savedPosition.current, viewPos, ease)
        const currentLook = new THREE.Vector3().lerpVectors(savedLookAt.current, orbPos, ease)
        camera.lookAt(currentLook)

        if (zoomProgress.current >= 1 && !zoomCompleted.current) {
          zoomCompleted.current = true
          if (onZoomComplete) onZoomComplete()
        }
      }
      return
    }

    // ===== ZOOM OUT (returning from orb) =====
    if (!locked && wasLocked.current) {
      if (isZooming.current !== 'out') {
        isZooming.current = 'out'
        zoomProgress.current = 1
      }

      const ZOOM_SPEED = 0.005
      zoomProgress.current = Math.max(0, zoomProgress.current - ZOOM_SPEED)
      const t = zoomProgress.current
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

      if (zoomTarget) {
        const VIEW_DISTANCE = 150
        const orbPos = new THREE.Vector3(...zoomTarget)
        const dirToOrb = orbPos.clone().sub(savedPosition.current).normalize()
        const viewPos = orbPos.clone().sub(dirToOrb.multiplyScalar(VIEW_DISTANCE))

        camera.position.lerpVectors(savedPosition.current, viewPos, ease)
        const currentLook = new THREE.Vector3().lerpVectors(savedLookAt.current, orbPos, ease)
        camera.lookAt(currentLook)
      }

      if (zoomProgress.current <= 0) {
        wasLocked.current = false
        isZooming.current = null
      }
      return
    }

    // ===== INTRO LERP (fly to first waypoint) =====
    if (!introReady.current) {
      introProgress.current = Math.min(1, introProgress.current + 0.004)
      const t = introProgress.current
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

      const wp0 = GUIDED_WAYPOINTS[0]
      camera.position.lerpVectors(introStartPos.current, wp0.position, ease)
      const look = new THREE.Vector3().lerpVectors(introStartLook.current, wp0.lookAt, ease)
      camera.lookAt(look)

      if (introProgress.current >= 1) {
        introReady.current = true
        if (!introFired.current && onReady) {
          introFired.current = true
          onReady()
        }
      }
      return
    }

    // ===== CONTINUOUS SCROLL INTERPOLATION =====
    scrollCurrent.current += (scrollTarget.current - scrollCurrent.current) * SCROLL_LERP_SPEED

    const progress = scrollCurrent.current
    const segIndex = Math.min(Math.floor(progress), maxProgress - 1)
    const segT = progress - segIndex

    const wpA = GUIDED_WAYPOINTS[segIndex]
    const wpB = GUIDED_WAYPOINTS[Math.min(segIndex + 1, maxProgress)]

    const ease = segT * segT * (3 - 2 * segT)

    camera.position.lerpVectors(wpA.position, wpB.position, ease)
    const currentLook = new THREE.Vector3().lerpVectors(wpA.lookAt, wpB.lookAt, ease)
    camera.lookAt(currentLook)

    if (onScrollProgress) {
      onScrollProgress(progress, maxProgress)
    }

    const nearestIndex = Math.round(progress)
    const isNearWaypoint = Math.abs(progress - nearestIndex) < 0.15
    const wp = GUIDED_WAYPOINTS[Math.min(nearestIndex, maxProgress)]
    const newActiveId = isNearWaypoint ? wp.projectId : null

    if (newActiveId !== lastReportedId.current) {
      lastReportedId.current = newActiveId
      if (onActiveChange) {
        onActiveChange(newActiveId)
      }
    }
  })

  return null
}

// ============================================================================
// CINEMATIC ORBIT CAMERA
// Auto-flies through guided waypoints then loops back to start. Press C.
// ============================================================================
const CINEMATIC_SPEED = 0.001

function CinematicOrbitCamera({ onComplete }: { onComplete?: () => void }) {
  const { camera } = useThree()

  const waypoints = useRef<{ position: THREE.Vector3; lookAt: THREE.Vector3 }[]>([])
  const progress = useRef(0)
  const done = useRef(false)

  const introProgress = useRef(0)
  const introReady = useRef(false)
  const introStartPos = useRef(new THREE.Vector3())
  const introStartLook = useRef(new THREE.Vector3())

  useEffect(() => {
    const loop = [...GUIDED_WAYPOINTS, GUIDED_WAYPOINTS[0]]
    waypoints.current = loop
    progress.current = 0
    done.current = false

    introStartPos.current.copy(camera.position)
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    introStartLook.current.copy(camera.position).add(dir.multiplyScalar(500))
    introProgress.current = 0
    introReady.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(() => {
    if (done.current) return

    // Intro lerp to first waypoint
    if (!introReady.current) {
      introProgress.current = Math.min(1, introProgress.current + 0.004)
      const t = introProgress.current
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

      const wp0 = waypoints.current[0]
      camera.position.lerpVectors(introStartPos.current, wp0.position, ease)
      const look = new THREE.Vector3().lerpVectors(introStartLook.current, wp0.lookAt, ease)
      camera.lookAt(look)

      if (introProgress.current >= 1) introReady.current = true
      return
    }

    const wps = waypoints.current
    const maxProgress = wps.length - 1

    progress.current = Math.min(maxProgress, progress.current + CINEMATIC_SPEED)

    const segIndex = Math.min(Math.floor(progress.current), maxProgress - 1)
    const segT = progress.current - segIndex
    const ease = segT * segT * (3 - 2 * segT)

    const wpA = wps[segIndex]
    const wpB = wps[Math.min(segIndex + 1, maxProgress)]

    camera.position.lerpVectors(wpA.position, wpB.position, ease)
    const look = new THREE.Vector3().lerpVectors(wpA.lookAt, wpB.lookAt, ease)
    camera.lookAt(look)

    if (progress.current >= maxProgress) {
      done.current = true
      if (onComplete) onComplete()
    }
  })

  return null
}

// ============================================================================
// YGGDRASIL TREE MODEL (MERGED)
// - Leaves: from GoodBake1.glb (the good ones!)
// - Trunk: from MetallicLook.glb (chrome effect)
// ============================================================================
function YggdrasilTree({ 
  scale = [1, 1, 1],
  uniformScale = 1,
  trunkScale = [1, 1, 1],
  trunkEnvMapIntensity = 2.5,
}: { 
  scale?: [number, number, number]           // X/Y/Z ratios
  uniformScale?: number                      // Multiplier applied to all axes equally
  trunkScale?: [number, number, number]
  trunkEnvMapIntensity?: number
}) {
  const finalScale: [number, number, number] = [
    scale[0] * uniformScale,
    scale[1] * uniformScale,
    scale[2] * uniformScale,
  ]
  const leavesGLB = useGLTF('/Yggdrasil_Tree_GoodBake1.glb')
  const trunkGLB = useGLTF('/Yggdrasil_Tree_MetallicLook.glb')

  useEffect(() => {
    // ========== LEAVES MODEL: Show only leaf materials ==========
    leavesGLB.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true

        const materials = Array.isArray(child.material) ? child.material : [child.material]
        
        materials.forEach((mat) => {
          if (!mat) return
          const matName = mat.name.toLowerCase()
          
          if (matName.includes('leaf')) {
            mat.visible = true
            // Glowing cyan leaves!
            mat.emissive = new THREE.Color('#00ffff')
            mat.emissiveIntensity = 1.0 // blue vein brightness
            mat.metalness = 0.5
            mat.roughness = 0.3
            mat.envMapIntensity = 1.2
            mat.polygonOffset = true
            mat.polygonOffsetFactor = -1
            mat.polygonOffsetUnits = -1
          } else {
            // Hide trunk from leaves model
            mat.visible = false
          }
          mat.needsUpdate = true
        })
      }
    })

    // ========== TRUNK MODEL: Show only trunk materials ==========
    trunkGLB.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true

        const materials = Array.isArray(child.material) ? child.material : [child.material]
        
        materials.forEach((mat) => {
          if (!mat) return
          const matName = mat.name.toLowerCase()
          
          if (matName.includes('leaf')) {
            // Hide leaves from trunk model
            mat.visible = false
          } else {
            // Trunk: bright white so bloom catches the edges
            mat.visible = true
            mat.color = new THREE.Color('#ffffff')
            mat.emissive = new THREE.Color('#ffffff')
            mat.emissiveIntensity = 0.15
            mat.roughness = 0.4
          }
          mat.needsUpdate = true
        })
      }
    })
  }, [leavesGLB.scene, trunkGLB.scene, trunkEnvMapIntensity])

  return (
    <group scale={finalScale}>
      <primitive object={leavesGLB.scene} scale={trunkScale} />
      <primitive object={trunkGLB.scene} scale={trunkScale} />
    </group>
  )
}

// Preload both models
useGLTF.preload('/Yggdrasil_Tree_GoodBake1.glb')
useGLTF.preload('/Yggdrasil_Tree_MetallicLook.glb')

// ============================================================================
// CLOUD FLOOR (Blender-made) — ORIGINAL (commented out for cloud_box test)
// ============================================================================
// function CloudFloor({
//   position = [0, 0, 0] as [number, number, number],
//   scale = 1 as number | [number, number, number],
//   rotation = [0, 0, 0] as [number, number, number],
// }: {
//   position?: [number, number, number]
//   scale?: number | [number, number, number]
//   rotation?: [number, number, number]
// }) {
//   const { scene } = useGLTF('/clouds_with_light_mark_II.glb')
//
//   useEffect(() => {
//     scene.traverse((child) => {
//       if (child instanceof THREE.Mesh) {
//         child.material = new THREE.MeshStandardMaterial({
//           color: new THREE.Color('#b8bcc8'),
//           roughness: 1,
//           metalness: 0,
//           emissive: new THREE.Color('#e8e0f0'),
//           emissiveIntensity: 0.1,
//           side: THREE.DoubleSide,
//         })
//       }
//     })
//   }, [scene])
//
//   return (
//     <primitive object={scene} position={position} scale={scale} rotation={rotation} />
//   )
// }
//
// useGLTF.preload('/clouds_with_light_mark_II.glb')

// ============================================================================
// CLOUD BOX (Blender-made) — Testing thick cloud volume
// ============================================================================
function CloudFloor({
  position = [0, 0, 0] as [number, number, number],
  scale = 1 as number | [number, number, number],
  rotation = [0, 0, 0] as [number, number, number],
}: {
  position?: [number, number, number]
  scale?: number | [number, number, number]
  rotation?: [number, number, number]
}) {
  const { scene } = useGLTF('/cloud_box_pro.glb')

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#b8bcc8'),    // Cloud surface colour (affected by environment preset)
          roughness: 1,                         // 0 = mirror-shiny, 1 = matte
          metalness: 0,                         // 0 = non-metal, 1 = fully metallic
          emissive: new THREE.Color('#e8e0f0'), // Self-glow colour tint (independent of lights)
          emissiveIntensity: 0.1,               // Self-glow brightness (0 = off, higher = brighter)
          envMapIntensity: 0.7,                 // How much environment preset affects clouds (1 = full, 0 = none)
          side: THREE.DoubleSide,               // Render both faces of the mesh
        })
      }
    })
  }, [scene])

  return (
    <primitive object={scene} position={position} scale={scale} rotation={rotation} />
  )
}

useGLTF.preload('/cloud_box_pro.glb')

// ============================================================================
// BLOOM EFFECT
// Post-processing bloom for glowing elements
// ============================================================================
function BloomEffect({ 
  strength = 0.8, 
  radius = 0.5, 
  threshold = 0.3 
}: { 
  strength?: number
  radius?: number
  threshold?: number 
}) {
  const { gl, scene, camera, size } = useThree()
  const composerRef = useRef<EffectComposer | null>(null)

  useEffect(() => {
    const composer = new EffectComposer(gl)
    composer.addPass(new RenderPass(scene, camera))
    
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      strength,
      radius,
      threshold
    )
    composer.addPass(bloomPass)
    
    composerRef.current = composer

    return () => {
      composer.dispose()
    }
  }, [gl, scene, camera, size, strength, radius, threshold])

  useFrame(() => {
    if (composerRef.current) {
      composerRef.current.render()
    }
  }, 1) // Priority 1 = runs after default render

  return null
}

// ============================================================================
// LOADING SCREEN
// Shown while the GLB model is being loaded
// ============================================================================
function LoadingScreen({ progress }: { progress: number }) {
  return (
    <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center">
      <div className="text-6xl mb-6">🌳</div>
      <div className="text-white text-2xl mb-2 font-semibold">Yggdrasil Portfolio</div>
      <div className="text-slate-400 text-sm mb-6">Loading World Tree...</div>
      <div className="w-64 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-slate-500 text-xs mt-2">{Math.round(progress)}%</div>
    </div>
  )
}


// ============================================================================
// INTERACTION MANAGER
// Per-frame proximity detection: finds the nearest orb within range
// ============================================================================
const INTERACTION_RANGE = 800

function InteractionManager({
  onActiveChange,
}: {
  onActiveChange: (projectId: string | null) => void
}) {
  const { camera } = useThree()
  const lastActiveId = useRef<string | null>(null)

  useFrame(() => {
    let nearestId: string | null = null
    let nearestDist = Infinity

    for (const project of projects) {
      const orbPos = new THREE.Vector3(...project.position)
      const dist = camera.position.distanceTo(orbPos)
      if (dist < INTERACTION_RANGE && dist < nearestDist) {
        nearestDist = dist
        nearestId = project.id
      }
    }

    if (nearestId !== lastActiveId.current) {
      lastActiveId.current = nearestId
      onActiveChange(nearestId)
    }
  })

  return null
}

// ============================================================================
// WORLD - Main 3D Scene Contents
// Contains lighting, tree, ground, fog, and camera controller
// ============================================================================
function SceneEnvironmentIntensity({ intensity }: { intensity: number }) {
  const { scene } = useThree()
  useEffect(() => {
    (scene as unknown as { environmentIntensity: number }).environmentIntensity = intensity
  }, [scene, intensity])
  return null
}

function World({
  activeProjectId,
  viewingProjectId,
  zoomReached,
  isLocked,
  zoomTarget,
  onActiveChange,
  onInteract,
  onExit,
  onZoomComplete,
  themePreset,
  cameraMode,
  onScrollProgress,
  onGuidedReady,
  onCinematicComplete,
  chatOpen,
}: {
  activeProjectId: string | null
  viewingProjectId: string | null
  zoomReached: boolean
  isLocked: boolean
  zoomTarget: [number, number, number] | null
  onActiveChange: (id: string | null) => void
  onInteract: () => void
  onExit: () => void
  onZoomComplete: () => void
  themePreset: PresetsType
  cameraMode: 'freeRoam' | 'guided' | 'cinematic'
  onScrollProgress: (progress: number, total: number) => void
  onGuidedReady: () => void
  onCinematicComplete: () => void
  chatOpen: boolean
}) {
  return (
    <>
      {/* ========== ENVIRONMENT / SKYBOX ========== */}
      {/* Galaxy cubemap for visible background */}
      <Environment
        files={[
          '/skybox/px.png',  // Right (+X)
          '/skybox/nx.png',  // Left (-X)
          '/skybox/py.png',  // Up (+Y)
          '/skybox/ny.png',  // Down (-Y)
          '/skybox/nz.png',  // Back (-Z)
          '/skybox/pz.png',  // Front (+Z)
        ]}
        background
      />
      <Environment preset={themePreset} background={false} />
      <SceneEnvironmentIntensity intensity={0.3} />

      {/* ========== LIGHT RIG ========== */}
      {/* <ambientLight intensity={0.15} /> */}
      <directionalLight
        position={[0, -10, 0]}         // Below (underlight, dramatic)
        // intensity={0.6}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-near={0.5}
        shadow-camera-far={200}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
      />


      {/* ========== THE WORLD TREE ========== */}
      {/* Materials come from Blender — only tweak envMapIntensity here */}
      <YggdrasilTree
        scale={[1.2, 2, 1.2]}               // X/Y/Z ratios (taller than wide)
        uniformScale={1500}                 // Overall size multiplier
        trunkScale={[1.4, 1, 1.4]}        // Wider trunk
        trunkEnvMapIntensity={3.2}        // Boost environment reflections
      />

      {/* ========== PROJECT ORBS ========== */}
      {projects.map((project) => (
        <ProjectOrb
          key={project.id}
          project={project}
          isActive={activeProjectId === project.id}
          isViewing={viewingProjectId === project.id}
        />
      ))}

      {/* ========== RATATOSKR — 3D squirrel model ========== */}
      <RatatoskrModel chatOpen={chatOpen} />

      {/* ========== INTERACTION MANAGER (free roam only) ========== */}
      {cameraMode === 'freeRoam' && (
        <InteractionManager onActiveChange={onActiveChange} />
      )}

      {/* ========== CLOUD FLOOR (Blender) ========== */}
      {/* Baked volumetric cloud mesh — tree trunk passes through */}
      <CloudFloor
        position={[0, 400, 0]}
        scale={[24, 16, 24]}          // Wider cloud box, same height
        rotation={[Math.PI, 0, 0]}   // Flip so the bulk extends upward
      />


      {/* ========== CAMERA CONTROLLER ========== */}
      {cameraMode === 'freeRoam' && (
        <CinematicCamera
          moveSpeed={3.0}
          friction={0.96}
          lookSensitivity={1.2}
          deadZone={0.15}
          startupDelay={1000}
          minHeight={450}
          maxHeight={2800}
          maxDistance={4200}
          treeCenter={new THREE.Vector3(0, 95, 0)}
          locked={isLocked}
          zoomTarget={zoomTarget}
          onInteract={onInteract}
          onExit={onExit}
          onZoomComplete={onZoomComplete}
        />
      )}
      {cameraMode === 'cinematic' && (
        <CinematicOrbitCamera onComplete={onCinematicComplete} />
      )}
      {cameraMode === 'guided' && (
        <GuidedCamera
          locked={isLocked}
          zoomTarget={zoomTarget}
          onInteract={onInteract}
          onExit={onExit}
          onZoomComplete={onZoomComplete}
          onActiveChange={onActiveChange}
          onScrollProgress={onScrollProgress}
          onReady={onGuidedReady}
        />
      )}

      {/* ========== BLOOM POST-PROCESSING ========== */}
      <BloomEffect strength={0.2} radius={0.6} threshold={0.35} />
    </>
  )
}

// ============================================================================
// SCENE - Root Component
// Handles loading state and renders the Canvas
// ============================================================================
export default function Scene() {
  const [loadingState, setLoadingState] = useState<'loading' | 'ready'>('loading')
  const [progress, setProgress] = useState(0)

  const [themePreset, setThemePreset] = useState<PresetsType>('park')
  const [cameraMode, setCameraMode] = useState<'freeRoam' | 'guided' | 'cinematic'>('guided')
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const [guidedProgress, setGuidedProgress] = useState(0)
  const [guidedTotal, setGuidedTotal] = useState(1)
  const [showScrollHint, setShowScrollHint] = useState(false)
  const scrollHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleScrollProgress = useCallback((progress: number, total: number) => {
    setGuidedProgress(progress)
    setGuidedTotal(total)
  }, [])

  const handleGuidedReady = useCallback(() => {
    setShowScrollHint(true)
    scrollHintTimer.current = setTimeout(() => setShowScrollHint(false), 4000)
  }, [])

  useEffect(() => {
    if (cameraMode !== 'guided') {
      setShowScrollHint(false)
      if (scrollHintTimer.current) clearTimeout(scrollHintTimer.current)
    }
    return () => {
      if (scrollHintTimer.current) clearTimeout(scrollHintTimer.current)
    }
  }, [cameraMode])

  // Orb interaction state (lifted here so ProjectPanel can access it)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [viewingProjectId, setViewingProjectId] = useState<string | null>(null)
  const [zoomReached, setZoomReached] = useState(false)
  const lastZoomTarget = useRef<[number, number, number] | null>(null)
  const isLocked = viewingProjectId !== null

  const viewingProject = viewingProjectId
    ? projects.find((p) => p.id === viewingProjectId) ?? null
    : null

  const zoomTarget = viewingProject?.position ?? lastZoomTarget.current

  const handleActiveChange = useCallback((id: string | null) => {
    if (!isLocked) setActiveProjectId(id)
  }, [isLocked])

  const handleInteract = useCallback(() => {
    if (activeProjectId && !viewingProjectId) {
      const project = projects.find((p) => p.id === activeProjectId)
      if (project) lastZoomTarget.current = project.position
      setViewingProjectId(activeProjectId)
      setZoomReached(false)
    }
  }, [activeProjectId, viewingProjectId])

  const handleExit = useCallback(() => {
    if (viewingProjectId) {
      setViewingProjectId(null)
      setZoomReached(false)
    }
  }, [viewingProjectId])

  const handleZoomComplete = useCallback(() => {
    setZoomReached(true)
  }, [])

  const handleCinematicComplete = useCallback(() => {
    setCameraMode('guided')
  }, [])

  const [showRatatoskr, setShowRatatoskr] = useState(false)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') {
        setShowRatatoskr((v) => !v)
        return
      }
      if (e.code === 'KeyG' && !isLocked) {
        setCameraMode((m) => (m === 'freeRoam' ? 'guided' : 'freeRoam'))
      }
      if (e.code === 'KeyC' && !isLocked) {
        setCameraMode((m) => (m === 'cinematic' ? 'freeRoam' : 'cinematic'))
      }
      if (e.code === 'KeyT' && !isLocked) {
        const presets: PresetsType[] = ['city', 'dawn', 'forest', 'lobby', 'park', 'sunset', 'warehouse']
        setThemePreset((current) => {
          const idx = presets.indexOf(current)
          return presets[(idx + 1) % presets.length]
        })
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isLocked])

  // Pre-load all GLB models with progress tracking
  useEffect(() => {
    const loader = new GLTFLoader()
    let loadedCount = 0
    const totalModels = 3
    const progressPerModel: number[] = [0, 0, 0]

    const updateProgress = () => {
      const total = progressPerModel.reduce((a, b) => a + b, 0) / totalModels
      setProgress(total)
    }

    const checkComplete = () => {
      loadedCount++
      if (loadedCount === totalModels) {
        setProgress(100)
        setTimeout(() => setLoadingState('ready'), 300)
      }
    }

    // Load leaves model (GoodBake1)
    loader.load(
      '/Yggdrasil_Tree_GoodBake1.glb',
      () => checkComplete(),
      (event) => {
        if (event.lengthComputable) {
          progressPerModel[0] = (event.loaded / event.total) * 100
          updateProgress()
        }
      },
      (error) => console.error('Error loading leaves model:', error)
    )

    // Load trunk model (MetallicLook)
    loader.load(
      '/Yggdrasil_Tree_MetallicLook.glb',
      () => checkComplete(),
      (event) => {
        if (event.lengthComputable) {
          progressPerModel[1] = (event.loaded / event.total) * 100
          updateProgress()
        }
      },
      (error) => console.error('Error loading trunk model:', error)
    )

    // Load Ratatoskr
    loader.load(
      '/Ratatoskr.glb',
      () => checkComplete(),
      (event) => {
        if (event.lengthComputable) {
          progressPerModel[2] = (event.loaded / event.total) * 100
          updateProgress()
        }
      },
      (error) => console.error('Error loading Ratatoskr model:', error)
    )
  }, [])

  // Show loading screen while model loads
  if (loadingState === 'loading') {
    return <LoadingScreen progress={progress} />
  }

  return (
    <div className="w-full h-full relative bg-[#050510]">
      {/* ========== THREE.JS CANVAS ========== */}
      <Canvas
        shadows
        camera={{ position: [-66, 1347, 3985], fov: 52, near: 0.1, far: 20000 }}
        gl={{
          antialias: true,
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
      >
        <World
          activeProjectId={activeProjectId}
          viewingProjectId={viewingProjectId}
          zoomReached={zoomReached}
          isLocked={isLocked}
          zoomTarget={zoomTarget}
          onActiveChange={handleActiveChange}
          onInteract={handleInteract}
          onExit={handleExit}
          onZoomComplete={handleZoomComplete}
          themePreset={themePreset}
          cameraMode={cameraMode}
          onScrollProgress={handleScrollProgress}
          onGuidedReady={handleGuidedReady}
          onCinematicComplete={handleCinematicComplete}
          chatOpen={showRatatoskr}
        />
      </Canvas>

      {/* ========== GUIDED TOUR: SCROLL PROGRESS + HINT ========== */}
      {cameraMode === 'guided' && !zoomReached && (
        <>
          {/* Scroll progress bar — right edge */}
          <div
            className="fixed right-3 z-30 pointer-events-none"
            style={{
              top: '50%',
              transform: 'translateY(-50%)',
              height: '80vh',
            }}
          >
            <div className="relative w-[24px] h-full rounded-full overflow-hidden"
              style={{ background: 'rgba(255, 255, 255, 0.08)' }}
            >
              <div
                className="absolute bottom-0 left-0 w-full rounded-full"
                style={{
                  height: `${guidedTotal > 0 ? (guidedProgress / guidedTotal) * 100 : 0}%`,
                  background: 'linear-gradient(to top, rgba(80, 180, 255, 0.6), rgba(80, 230, 130, 0.5) 50%, rgba(255, 120, 200, 0.6))',
                  boxShadow: '0 0 6px rgba(80, 200, 180, 0.3)',
                }}
              />
            </div>
          </div>

          {/* Scroll hint text */}
          <div
            className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none select-none"
            style={{
              opacity: showScrollHint ? 1 : 0,
              transition: 'opacity 1.2s ease',
            }}
          >
            <div
              className="text-center rounded-md"
              style={{
                background: 'rgba(140, 140, 160, 0.65)',
                lineHeight: 1,
                padding: '0.4em 0.6em',
              }}
            >
            <p
              className="text-2xl tracking-[0.35em] uppercase font-bold"
              style={{ color: '#ffffff' }}
            >
              Scroll to navigate
            </p>
            </div>
          </div>

          <style>{`
            @keyframes guidedScrollPulse {
              0%, 100% { opacity: 0.3; transform: translateY(0); }
              50% { opacity: 1; transform: translateY(4px); }
            }
          `}</style>
        </>
      )}

      {/* ========== CONTROL PANEL ========== */}
      {!zoomReached && !isFullscreen && (
        <div
          className="fixed bottom-6 right-12 z-40 flex flex-col gap-2 p-3 rounded-xl"
          style={{
            background: 'rgba(140, 140, 160, 0.65)',
            border: 'none',
          }}
        >
          {/* Mode indicator + key hint */}
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[10px] uppercase tracking-widest"
              style={{ color: '#ffffff' }}
            >
              {cameraMode === 'freeRoam' ? 'Free Roam' : 'Guided Tour'}
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold"
              style={{
                background: 'rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
              }}
            >
              G
            </span>
          </div>

          {/* Cinematic key hint */}
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[10px] uppercase tracking-widest"
              style={{ color: '#ffffff' }}
            >
              Cinematic
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold"
              style={{
                background: 'rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
              }}
            >
              C
            </span>
          </div>

          {/* Divider */}
          <div className="h-px w-full" style={{ background: 'rgba(255, 255, 255, 0.3)' }} />

          {/* Theme indicator + key hint */}
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[10px] uppercase tracking-widest"
              style={{ color: '#ffffff' }}
            >
              {themePreset}
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold"
              style={{
                background: 'rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
              }}
            >
              T
            </span>
          </div>

          {/* Divider */}
          <div className="h-px w-full" style={{ background: 'rgba(255, 255, 255, 0.3)' }} />

          {/* Ratatoskr key hint */}
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[10px] uppercase tracking-widest"
              style={{ color: '#ffffff' }}
            >
              Ratatoskr
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold"
              style={{
                background: 'rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
              }}
            >
              R
            </span>
          </div>
        </div>
      )}

      {/* ========== RATATOSKR CHAT UI ========== */}
      <RatatoskrChat
        open={showRatatoskr}
        onClose={() => setShowRatatoskr(false)}
      />

      {/* ========== PROJECT INFO PANEL ========== */}
      {zoomReached && viewingProject && (
        <ProjectPanel
          project={viewingProject}
          visible={zoomReached}
        />
      )}
    </div>
  )
}
