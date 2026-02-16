'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Environment } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import * as THREE from 'three'

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

    // Add all event listeners
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mouseenter', handleMouseEnter)
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    // Cleanup on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mouseenter', handleMouseEnter)
      canvas.removeEventListener('wheel', handleWheel)
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current)
    }
  }, [gl, size, startupDelay])

  // ========== FRAME UPDATE (runs every frame) ==========
  useFrame(() => {
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
    
    // R/Space = up, F/Shift = down
    if (k.has('KeyR') || k.has('Space')) inputDir.y += 1
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
      // Vertical: snappy for project viewing
      velocity.current.y *= 0.7
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
// YGGDRASIL TREE MODEL (MERGED)
// - Leaves: from GoodBake1.glb (the good ones!)
// - Trunk: from MetallicLook.glb (chrome effect)
// ============================================================================
function YggdrasilTree({ 
  scale = 5,
  trunkScale = [1, 1, 1],
  trunkEnvMapIntensity = 2.5,
}: { 
  scale?: number | [number, number, number]
  trunkScale?: [number, number, number]
  trunkEnvMapIntensity?: number
}) {
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
            mat.envMapIntensity = 2.2
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
            // Trunk: whiter and slightly brighter
            mat.visible = true
            mat.color = new THREE.Color('#ffffff')
            mat.emissive = new THREE.Color('#ffffff')
            mat.emissiveIntensity = 0.15
          }
          mat.needsUpdate = true
        })
      }
    })
  }, [leavesGLB.scene, trunkGLB.scene, trunkEnvMapIntensity])

  return (
    <group scale={scale}>
      <primitive object={leavesGLB.scene} scale={trunkScale} />
      <primitive object={trunkGLB.scene} scale={trunkScale} />
    </group>
  )
}

// Preload both models
useGLTF.preload('/Yggdrasil_Tree_GoodBake1.glb')
useGLTF.preload('/Yggdrasil_Tree_MetallicLook.glb')

// ============================================================================
// CLOUD FLOOR (Blender-made)
// Baked volumetric cloud mesh positioned at the tree's base
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
  const { scene } = useGLTF('/clouds_with_light_mark_II.glb')

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#b8bcc8'),    // Cloud surface colour (affected by environment preset)
          roughness: 1,                         // 0 = mirror-shiny, 1 = matte
          metalness: 0,                         // 0 = non-metal, 1 = fully metallic
          emissive: new THREE.Color('#e8e0f0'), // Self-glow colour tint (independent of lights)
          emissiveIntensity: 0.1,               // Self-glow brightness (0 = off, higher = brighter)
          side: THREE.DoubleSide,               // Render both faces of the mesh
        })
      }
    })
  }, [scene])

  return (
    <primitive object={scene} position={position} scale={scale} rotation={rotation} />
  )
}

useGLTF.preload('/clouds_with_light_mark_II.glb')

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
// WORLD - Main 3D Scene Contents
// Contains lighting, tree, ground, fog, and camera controller
// ============================================================================
function World() {
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
      {/* Bright set for material reflections (chrome trunk!) */}
      <Environment preset="dawn" background={false} />

      {/* ========== LIGHT RIG ========== */}
      {/* <ambientLight intensity={0.15} /> */}
      <directionalLight
        position={[8, 14, 8]}
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
        scale={[150, 170, 150]}            // Massive world tree
        trunkScale={[1.4, 1, 1.4]}        // Wider trunk
        trunkEnvMapIntensity={2.5}        // Boost environment reflections
      />


      {/* ========== CLOUD FLOOR (Blender) ========== */}
      {/* Baked volumetric cloud mesh — tree trunk passes through */}
      <CloudFloor
        position={[0, 10, 0]}         // Y = base of tree (adjust as needed)
        scale={[8, 4, 8]}
        rotation={[Math.PI, 0, 0]}    // Flip upside down via rotation instead
      />

      {/* Uplight — directional light shining upward into cloud floor */}
      {/* <directionalLight
        position={[0, -20, 0]}
        intensity={4.0}
        color="#aabbff"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-near={0.5}
        shadow-camera-far={200}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
      /> */}

      {/* ========== FOG (disabled) ========== */}
      {/* <fog attach="fog" args={['#aaaabb', 50, 400]} /> */}

      {/* ========== CAMERA CONTROLLER ========== */}
      <CinematicCamera
        moveSpeed={0.2}
        friction={0.99}
        lookSensitivity={1.2}
        deadZone={0.15}
        startupDelay={1000}
        minHeight={4}
        maxHeight={300}
        maxDistance={300}
        treeCenter={new THREE.Vector3(0, 100, 0)}
      />

      {/* ========== BLOOM POST-PROCESSING ========== */}
      <BloomEffect strength={0.3} radius={0.3} threshold={0.7} />
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

  // Pre-load BOTH GLB models with progress tracking
  useEffect(() => {
    const loader = new GLTFLoader()
    let loadedCount = 0
    const totalModels = 2
    const progressPerModel: number[] = [0, 0]

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
        camera={{ position: [0, 8, 25], fov: 52, near: 0.1 }}
        gl={{
          antialias: true,
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
      >
        {/* Background handled by Environment skybox */}
        <World />
      </Canvas>

      {/* ========== UI OVERLAY ========== */}
      <div className="absolute top-8 left-8 text-white pointer-events-none">
        <h1 className="text-3xl font-bold mb-2">🌳 Yggdrasil Portfolio</h1>
        <p className="text-emerald-400">World Tree Loaded ✨</p>
        <p className="text-sm text-slate-500 mt-4">WASD / Arrows to float • Space/R to rise • Shift/F to fall</p>
        <p className="text-xs text-slate-600 mt-1">Move mouse to look around</p>
      </div>
    </div>
  )
}
