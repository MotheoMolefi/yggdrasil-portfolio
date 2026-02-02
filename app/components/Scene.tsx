'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as THREE from 'three'

// Cinematic Camera Controller
function CinematicCamera({ 
  moveSpeed = 0.08,
  friction = 0.95,        // How quickly momentum decays (0.95 = gentle, 0.8 = quick stop)
  lookSensitivity = 1.5,  // How much the mouse controls camera direction
  deadZone = 0.1,         // Radius where mouse has no effect (center tolerance)
  startupDelay = 1000,    // Milliseconds before mouse control kicks in
  minHeight = 0.5,        // Floor (can't go below this)
  maxHeight = 1,          // Ceiling (can't go above this)
  maxDistance = 20,       // Maximum distance from tree center
  treeCenter = new THREE.Vector3(0, 5, 0)  // Center point of the tree
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
}) {
  const { camera, gl, size } = useThree()
  const keys = useRef<Set<string>>(new Set())
  const velocity = useRef(new THREE.Vector3(0, 0, 0))
  const mousePos = useRef({ x: 0, y: 0 })
  const mouseCenter = useRef<{ x: number; y: number } | null>(null)  // First mouse position becomes center
  const currentYaw = useRef(camera.rotation.y)  // Accumulated rotation
  const currentTurnSpeed = useRef(0)  // Smoothed turn speed
  const mouseControlReady = useRef(false)  // Delay before mouse works
  
  // Startup delay - mouse control doesn't work until this fires
  useEffect(() => {
    const timer = setTimeout(() => {
      mouseControlReady.current = true
    }, startupDelay)
    return () => clearTimeout(timer)
  }, [startupDelay])
  
  useEffect(() => {
    const canvas = gl.domElement
    
    // Keyboard handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current.add(e.code)
      // Prevent default for arrow keys to avoid page scroll
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault()
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code)
    
    // Mouse position (normalized -1 to 1)
    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = {
        x: (e.clientX / size.width) * 2 - 1,
        y: (e.clientY / size.height) * 2 - 1
      }
      
      // First mouse move becomes the "center" - no snap!
      if (mouseCenter.current === null) {
        mouseCenter.current = { ...currentPos }
      }
      
      // Store position relative to where user started
      mousePos.current = {
        x: currentPos.x - mouseCenter.current.x,
        y: currentPos.y - mouseCenter.current.y
      }
    }
    
    // Stop turning when mouse leaves the window
    const handleMouseLeave = () => {
      mousePos.current = { x: 0, y: 0 }  // Reset to neutral
    }
    
    // Reset center when mouse re-enters (prevents snap)
    const handleMouseEnter = (e: MouseEvent) => {
      mouseCenter.current = {
        x: (e.clientX / size.width) * 2 - 1,
        y: (e.clientY / size.height) * 2 - 1
      }
      mousePos.current = { x: 0, y: 0 }
    }
    
    // Scroll for up/down movement
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      // Add to velocity instead of direct movement for smooth feel
      velocity.current.y -= e.deltaY * 0.002
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mouseenter', handleMouseEnter)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mouseenter', handleMouseEnter)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [gl, size])
  
  useFrame(() => {
    const k = keys.current
    
    // Get camera's forward and right directions (horizontal plane only)
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    
    const right = new THREE.Vector3()
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
    
    // Build input direction (no acceleration, just set velocity)
    const inputDir = new THREE.Vector3(0, 0, 0)
    
    if (k.has('KeyW') || k.has('ArrowUp')) {
      inputDir.add(forward)
    }
    if (k.has('KeyS') || k.has('ArrowDown')) {
      inputDir.add(forward.clone().multiplyScalar(-1))
    }
    if (k.has('KeyA') || k.has('ArrowLeft')) {
      inputDir.add(right.clone().multiplyScalar(-1))
    }
    if (k.has('KeyD') || k.has('ArrowRight')) {
      inputDir.add(right)
    }
    if (k.has('KeyR') || k.has('Space')) {
      inputDir.y += 1
    }
    if (k.has('KeyF') || k.has('ShiftLeft') || k.has('ShiftRight')) {
      inputDir.y -= 1
    }
    
    // If there's input, set velocity to that direction (normalized) * speed
    if (inputDir.length() > 0) {
      inputDir.normalize().multiplyScalar(moveSpeed)
      velocity.current.copy(inputDir)
    } else {
      // No input - apply friction (drift to a stop)
      velocity.current.multiplyScalar(friction)
    }
    
    // Apply velocity to position
    camera.position.add(velocity.current)
    
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
    
    // Boundary constraint - keep camera within maxDistance of tree
    const distanceFromTree = camera.position.distanceTo(treeCenter)
    if (distanceFromTree > maxDistance) {
      // Push camera back toward tree center
      const direction = camera.position.clone().sub(treeCenter).normalize()
      camera.position.copy(treeCenter).add(direction.multiplyScalar(maxDistance))
      // Kill velocity in the outward direction
      velocity.current.multiplyScalar(0.5)
    }
    
    // Only process mouse after startup delay
    if (mouseControlReady.current) {
      // Apply dead zone - ignore small movements near center
      let effectiveMouseX = mousePos.current.x
      if (Math.abs(effectiveMouseX) < deadZone) {
        effectiveMouseX = 0  // Inside dead zone = no turning
      } else {
        // Subtract dead zone so turning starts from edge of dead zone
        effectiveMouseX = effectiveMouseX - Math.sign(effectiveMouseX) * deadZone
      }
      
      // Target turn speed based on mouse offset
      const targetTurnSpeed = -effectiveMouseX * lookSensitivity * 0.02
      
      // Smoothly ease into the turn speed (prevents snapping)
      currentTurnSpeed.current += (targetTurnSpeed - currentTurnSpeed.current) * 0.1
      
      // Accumulate rotation (this allows infinite spinning)
      currentYaw.current += currentTurnSpeed.current
    }
    
    // Apply rotation - no tilt, just yaw
    camera.rotation.x = 0  // Force no tilt
    camera.rotation.y = currentYaw.current
  })
  
  return null
}

// Load the Yggdrasil tree model
function YggdrasilTree() {
  const { scene } = useGLTF('/Yggdrasil_Tree.glb')
  return <primitive object={scene} />
}

// Loading Screen Component
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

// Main 3D Scene
function World() {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} />
      <pointLight position={[-5, 8, -5]} intensity={0.4} color="#4488ff" />
      
      {/* The World Tree */}
      <YggdrasilTree />
      
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <circleGeometry args={[20, 64]} />
        <meshStandardMaterial color="#1a2a3a" roughness={0.9} />
      </mesh>
      
      {/* Cinematic Camera Controller */}
      <CinematicCamera 
        moveSpeed={0.04}
        friction={0.94}
        lookSensitivity={1.2}
        deadZone={0.12}
        startupDelay={1000}
        minHeight={0.3}
        maxHeight={8}
        maxDistance={10}
        treeCenter={new THREE.Vector3(0, 4, 0)}
      />
    </>
  )
}

export default function Scene() {
  const [loadingState, setLoadingState] = useState<'loading' | 'ready'>('loading')
  const [progress, setProgress] = useState(0)
  
  useEffect(() => {
    const loader = new GLTFLoader()
    
    loader.load(
      '/Yggdrasil_Tree.glb',
      () => {
        setProgress(100)
        setTimeout(() => setLoadingState('ready'), 300)
      },
      (event) => {
        if (event.lengthComputable) {
          const percent = (event.loaded / event.total) * 100
          setProgress(percent)
        }
      },
      (error) => {
        console.error('Error loading model:', error)
      }
    )
  }, [])
  
  if (loadingState === 'loading') {
    return <LoadingScreen progress={progress} />
  }
  
  return (
    <div className="w-full h-full relative bg-slate-900">
      <Canvas camera={{ position: [2, 0.5, 5], fov: 60 }}>
        <World />
      </Canvas>
      
      {/* UI Overlay */}
      <div className="absolute top-8 left-8 text-white pointer-events-none">
        <h1 className="text-3xl font-bold mb-2">🌳 Yggdrasil Portfolio</h1>
        <p className="text-emerald-400">World Tree Loaded ✨</p>
        <p className="text-sm text-slate-500 mt-4">
          WASD / Arrows to float • Scroll to rise/fall
        </p>
        <p className="text-xs text-slate-600 mt-1">
          Move mouse to look around
        </p>
      </div>
    </div>
  )
}
