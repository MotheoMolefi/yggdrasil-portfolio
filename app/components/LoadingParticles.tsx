'use client'

/**
 * LoadingParticles — Enhanced 3D glowing text animation with:
 * - Street lamp-style lighting from 45° above
 * - Metallic text material with high gloss
 * - Golden particles with trailing light effects
 * - Particle burst effects every 2-3 seconds
 * - Mouse hover interaction with text offset and enhanced particle density
 */

import { useEffect, useRef, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import GPGPU from '@/app/lib/codrops/GPGPU'

const PARTICLE_GRID_SIZE = 320
const DISTANCE_IN_FRONT = 800
const GOLD = new THREE.Color(0.808, 0.647, 0.239)
const BURST_INTERVAL_MIN = 2000
const BURST_INTERVAL_MAX = 3000

// Enhanced shaders with trail and burst effects
const enhancedFragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPosition;
  
  uniform sampler2D uVelocityTexture;
  uniform sampler2D uPositionTexture;
  uniform vec3 uColor;
  uniform float uMinAlpha;
  uniform float uMaxAlpha;
  uniform float uTime;
  uniform float uHoverIntensity;
  uniform float uBurstStrength;
  
  // Random function
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }
  
  // Noise function for organic movement
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  
  void main() {
    float center = length(gl_PointCoord - 0.5);
    
    vec3 velocity = texture2D(uVelocityTexture, vUv).xyz * 100.0;
    vec3 position = texture2D(uPositionTexture, vUv).xyz;
    float speed = length(velocity);
    
    // Base alpha from velocity
    float repelled = min(1.0, speed * 0.4);
    float velocityAlpha = mix(uMinAlpha, uMaxAlpha, repelled);
    
    // Enhanced color with gold tint
    vec3 goldColor = vec3(1.0, 0.843, 0.0); // Bright gold
    vec3 baseColor = mix(uColor, goldColor, 0.3);
    vec3 finalColor = mix(baseColor, baseColor * 3.0, repelled);
    
    // Add trail effect based on velocity direction
    float trailIntensity = smoothstep(0.0, 1.0, speed * 2.0);
    finalColor += goldColor * trailIntensity * 0.5;
    
    // Burst effect - add sparkle
    float burstNoise = noise(vUv * 10.0 + uTime * 2.0);
    float burstSparkle = smoothstep(0.7, 1.0, burstNoise) * uBurstStrength;
    finalColor += goldColor * burstSparkle * 2.0;
    
    // Hover intensity boost
    finalColor *= (1.0 + uHoverIntensity * 0.5);
    velocityAlpha = min(1.0, velocityAlpha * (1.0 + uHoverIntensity * 0.3));
    
    // Soft particle edge
    float alpha = 1.0 - smoothstep(0.3, 0.5, center);
    alpha *= velocityAlpha;
    
    // Add glow at center
    float glow = 1.0 - smoothstep(0.0, 0.3, center);
    finalColor += goldColor * glow * 0.5;
    
    if (center > 0.5) { discard; }
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`

const enhancedVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPosition;
  
  uniform float uParticleSize;
  uniform sampler2D uPositionTexture;
  uniform float uHoverIntensity;
  uniform float uTime;
  
  void main() {
    vUv = uv;
    
    vec3 newpos = position;
    vec4 color = texture2D(uPositionTexture, vUv);
    newpos.xyz = color.xyz;
    
    vPosition = newpos;
    
    vec4 mvPosition = modelViewMatrix * vec4(newpos, 1.0);
    
    // Size variation based on hover
    float sizeMultiplier = 1.0 + uHoverIntensity * 0.5;
    
    // Add subtle pulsing
    sizeMultiplier *= 1.0 + sin(uTime * 2.0 + vUv.x * 10.0) * 0.1;
    
    gl_PointSize = (uParticleSize * sizeMultiplier / -mvPosition.z);
    
    gl_Position = projectionMatrix * mvPosition;
  }
`

const enhancedVelocityShader = /* glsl */ `
  uniform sampler2D uOriginalPosition;
  uniform vec3 uMouse;
  uniform float uMouseSpeed;
  uniform float uForce;
  uniform float uTime;
  uniform float uMouseActive;
  uniform float uHoverIntensity;
  uniform float uBurstActive;
  uniform vec3 uBurstCenter;
  uniform float uBurstRadius;
  
  // Simplex noise function
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
            
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  
  void main() {
    vec2 vUv = gl_FragCoord.xy / resolution.xy;
    
    vec3 position = texture2D(uCurrentPosition, vUv).xyz;
    vec3 original = texture2D(uOriginalPosition, vUv).xyz;
    vec3 velocity = texture2D(uCurrentVelocity, vUv).xyz;
    
    velocity *= uForce;
    
    // Attraction back to original shape
    vec3 direction = normalize(original - position);
    float dist = length(original - position);
    if (dist > 0.001) {
      float pull = 0.28 * min(1.0, dist * 0.04);
      // Stronger pull when hovering
      pull *= (1.0 + uHoverIntensity * 0.3);
      velocity += direction * pull;
    }
    
    // Mouse repel with enhanced effect when hovering
    if (uMouseActive > 0.5) {
      float mouseDistance = distance(position, uMouse);
      float maxDistance = 42.0 + uHoverIntensity * 20.0;
      if (mouseDistance < maxDistance) {
        vec3 pushDirection = normalize(position - uMouse);
        float falloff = 1.0 - mouseDistance / maxDistance;
        float basePush = 1.25 * falloff * (1.0 + uHoverIntensity);
        float speedPush = 0.95 * falloff * uMouseSpeed * (1.0 + uHoverIntensity);
        velocity += pushDirection * (basePush + speedPush);
      }
    }
    
    // Burst effect - explosive force from burst center
    if (uBurstActive > 0.5) {
      float burstDist = distance(position, uBurstCenter);
      if (burstDist < uBurstRadius) {
        vec3 burstDir = normalize(position - uBurstCenter);
        float burstFalloff = 1.0 - burstDist / uBurstRadius;
        velocity += burstDir * burstFalloff * 3.0 * uBurstActive;
      }
    }
    
    // Enhanced ambient drift with noise
    float t = uTime * 0.15;
    float noise1 = snoise(position * 0.01 + t * 0.5);
    float noise2 = snoise(position * 0.02 - t * 0.3);
    float noise3 = snoise(position * 0.015 + t * 0.4);
    
    velocity += 0.00005 * vec3(
      noise1 + cos(t * 0.7),
      noise2 + sin(t * 1.1),
      noise3
    );
    
    // Add swirling motion when hovering
    if (uHoverIntensity > 0.0) {
      vec3 swirl = vec3(
        sin(t + position.y * 0.01) * uHoverIntensity * 0.01,
        cos(t + position.x * 0.01) * uHoverIntensity * 0.01,
        sin(t * 0.5 + position.z * 0.01) * uHoverIntensity * 0.01
      );
      velocity += swirl;
    }
    
    gl_FragColor = vec4(velocity, 1.0);
  }
`

function makeSphereMesh(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(280, 64, 64)
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }))
  mesh.visible = false
  return mesh
}

function makeTextMesh(font: unknown): THREE.Mesh {
  const geo = new TextGeometry('Yggdrasil', {
    font: font as THREE.Font,
    size: 58,
    height: 16,
    curveSegments: 5,
  })
  geo.computeBoundingBox()
  const bbox = geo.boundingBox!
  const center = new THREE.Vector3()
  bbox.getCenter(center)
  geo.translate(-center.x, -center.y, -center.z)
  const size = new THREE.Vector3()
  bbox.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z)
  const scale = 850 / maxDim
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) * scale)
    pos.setY(i, pos.getY(i) * scale)
    pos.setZ(i, pos.getZ(i) * scale)
  }
  pos.needsUpdate = true
  geo.computeBoundingSphere()
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }))
  mesh.visible = false
  return mesh
}

// Create metallic text mesh with glow
function createMetallicText(font: unknown): THREE.Mesh {
  const geo = new TextGeometry('YGGDRASIL', {
    font: font as THREE.Font,
    size: 80,
    height: 25,
    curveSegments: 12,
    bevelEnabled: true,
    bevelThickness: 3,
    bevelSize: 2,
    bevelOffset: 0,
    bevelSegments: 8,
  })
  
  geo.computeBoundingBox()
  const bbox = geo.boundingBox!
  const center = new THREE.Vector3()
  bbox.getCenter(center)
  geo.translate(-center.x, -center.y, -center.z)
  
  // Metallic material optimized for white spotlight
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xc0c0c0),  // Silver base to show white light better
    metalness: 0.9,
    roughness: 0.2,
    emissive: new THREE.Color(0xffaa00),
    emissiveIntensity: 0.15,
    envMapIntensity: 1.0,
  })
  
  const mesh = new THREE.Mesh(geo, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  
  return mesh
}

export default function LoadingParticles() {
  const { gl, scene, camera, invalidate } = useThree()
  const groupRef = useRef<THREE.Group | null>(null)
  const textGroupRef = useRef<THREE.Group | null>(null)
  const gpgpuRef = useRef<GPGPU | null>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const textMeshRef = useRef<THREE.Mesh | null>(null)
  const composerRef = useRef<EffectComposer | null>(null)
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseNDCRef = useRef(new THREE.Vector2(0, 0))
  const lastNDCRef = useRef(new THREE.Vector2(0, 0))
  const mouseSpeedRef = useRef(0)
  const hitPointRef = useRef(new THREE.Vector3())
  const cancelledRef = useRef(false)
  const cleanupRef = useRef<(() => void) | null>(null)
  
  // Lighting refs
  const mainLightRef = useRef<THREE.SpotLight | null>(null)
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null)
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null)
  
  // Animation refs
  const timeRef = useRef(0)
  const hoverIntensityRef = useRef(0)
  const targetHoverIntensityRef = useRef(0)
  const isHoveringRef = useRef(false)
  const textOffsetRef = useRef(new THREE.Vector3(0, 0, 0))
  const targetTextOffsetRef = useRef(new THREE.Vector3(0, 0, 0))
  
  // Burst effect refs
  const burstActiveRef = useRef(0)
  const burstCenterRef = useRef(new THREE.Vector3(0, 0, 0))
  const lastBurstTimeRef = useRef(0)
  const nextBurstIntervalRef = useRef(BURST_INTERVAL_MIN + Math.random() * (BURST_INTERVAL_MAX - BURST_INTERVAL_MIN))
  
  // Enhanced GPGPU with custom shaders
  const initEnhancedGPGPU = useCallback((mesh: THREE.Mesh, group: THREE.Group, sizes: { width: number; height: number }) => {
    const mouse = { cursorPosition: new THREE.Vector3() }
    const params = {
      color: GOLD.clone(),
      size: 1000,
      minAlpha: 0.48,
      maxAlpha: 1.0,
      force: 0.82,
    }
    
    const gpgpu = new GPGPU({
      size: PARTICLE_GRID_SIZE,
      camera,
      renderer: gl,
      mouse,
      scene: group,
      model: mesh,
      sizes,
      params,
      events: {
        update: () => {
          mouseSpeedRef.current *= 0.85
          const u = (gpgpu as unknown as { uniforms: { velocityUniforms: { uMouseSpeed: { value: number } } } }).uniforms.velocityUniforms.uMouseSpeed
          if (u) u.value = mouseSpeedRef.current
        },
      },
    })
    
    // Override shaders with enhanced versions
    gpgpu.material.vertexShader = enhancedVertexShader
    gpgpu.material.fragmentShader = enhancedFragmentShader
    
    // Add enhanced uniforms
    gpgpu.material.uniforms.uTime = { value: 0 }
    gpgpu.material.uniforms.uHoverIntensity = { value: 0 }
    gpgpu.material.uniforms.uBurstStrength = { value: 0 }
    
    // Override velocity shader
    gpgpu.velocityVariable.material.fragmentShader = enhancedVelocityShader
    gpgpu.velocityVariable.material.uniforms.uHoverIntensity = { value: 0 }
    gpgpu.velocityVariable.material.uniforms.uBurstActive = { value: 0 }
    gpgpu.velocityVariable.material.uniforms.uBurstCenter = { value: new THREE.Vector3(0, 0, 0) }
    gpgpu.velocityVariable.material.uniforms.uBurstRadius = { value: 200 }
    
    gpgpu.material.needsUpdate = true
    gpgpu.velocityVariable.material.needsUpdate = true
    
    return gpgpu
  }, [camera, gl])

  useEffect(() => {
    cancelledRef.current = false
    gl.setClearColor(0x050510, 1)
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.4
    gl.outputColorSpace = THREE.SRGBColorSpace

    const sizes = {
      width: gl.domElement.clientWidth || window.innerWidth,
      height: gl.domElement.clientHeight || window.innerHeight,
    }

    function createScene(font: unknown) {
      if (cancelledRef.current) return
      
      // Create main group for particles
      const group = new THREE.Group()
      scene.add(group)
      groupRef.current = group
      
      // Create text group for 3D text
      const textGroup = new THREE.Group()
      scene.add(textGroup)
      textGroupRef.current = textGroup
      
      // Create particle mesh
      const mesh = makeTextMesh(font)
      meshRef.current = mesh
      
      // Create metallic text
      const textMesh = createMetallicText(font)
      textMeshRef.current = textMesh
      textGroup.add(textMesh)
      
      // Set up lighting - Street lamp style with dominant white spotlight
      // 1. Main spotlight from 45° above - PURE WHITE (like a street lamp)
      const mainLight = new THREE.SpotLight(0xffffff, 8000)
      // Position: high above at 45 degree angle
      mainLight.position.set(400, 600, 400)
      mainLight.angle = Math.PI / 8  // Narrow beam like street lamp
      mainLight.penumbra = 0.3  // Soft edge transition
      mainLight.decay = 0.5  // Slower falloff for street lamp effect
      mainLight.distance = 4000
      mainLight.castShadow = true
      mainLight.shadow.mapSize.width = 2048
      mainLight.shadow.mapSize.height = 2048
      mainLight.shadow.bias = -0.0001
      mainLight.shadow.camera.near = 100
      mainLight.shadow.camera.far = 2000
      mainLightRef.current = mainLight
      textGroup.add(mainLight)
      
      // Target the center of the text
      const lightTarget = new THREE.Object3D()
      lightTarget.position.set(0, 0, 0)
      textGroup.add(lightTarget)
      mainLight.target = lightTarget
      
      // 2. Very dim ambient light - let the spotlight dominate
      const ambientLight = new THREE.AmbientLight(0x101020, 0.15)
      ambientLightRef.current = ambientLight
      textGroup.add(ambientLight)
      
      // 3. Subtle rim light for edge definition only (very weak)
      const rimLight = new THREE.DirectionalLight(0x444460, 0.5)
      rimLight.position.set(-100, 50, -100)
      textGroup.add(rimLight)
      
      // Initialize enhanced GPGPU
      const gpgpu = initEnhancedGPGPU(mesh, group, sizes)
      gpgpuRef.current = gpgpu
      
      ;(gpgpu.uniforms.velocityUniforms.uMouse as { value: THREE.Vector3 }).value.set(1e6, 1e6, 1e6)
      ;(gpgpu.uniforms.velocityUniforms.uMouseActive as { value: number }).value = 0

      // Set up post-processing with stronger bloom
      const composer = new EffectComposer(gl)
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(
        new UnrealBloomPass(
          new THREE.Vector2(sizes.width, sizes.height),
          2.2,  // strength
          0.8,  // radius
          0.01  // threshold
        )
      )
      composerRef.current = composer

      const onResize = () => {
        const w = gl.domElement.clientWidth || window.innerWidth
        const h = gl.domElement.clientHeight || window.innerHeight
        gpgpu.material.uniforms.uResolution.value.set(w, h)
        composer.setSize(w, h)
        composer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      }
      
      const onMouseMove = (e: MouseEvent) => {
        const nx = (e.clientX / window.innerWidth) * 2 - 1
        const ny = (e.clientY / window.innerHeight) * -2 + 1
        mouseNDCRef.current.set(nx, ny)
        mouseSpeedRef.current = Math.min(
          Math.hypot(nx - lastNDCRef.current.x, ny - lastNDCRef.current.y) * 800,
          1.5
        )
        lastNDCRef.current.set(nx, ny)
        
        // Calculate target text offset based on mouse position
        targetTextOffsetRef.current.set(nx * 20, ny * 15, 0)
      }
      
      window.addEventListener('resize', onResize)
      window.addEventListener('mousemove', onMouseMove)
      
      const raf = requestAnimationFrame(() => invalidate())
      
      cleanupRef.current = () => {
        cancelAnimationFrame(raf)
        window.removeEventListener('resize', onResize)
        window.removeEventListener('mousemove', onMouseMove)
        scene.remove(group)
        scene.remove(textGroup)
        gpgpu.mesh.geometry.dispose()
        gpgpu.material.dispose()
        gpgpu.utils.getPositionTexture().dispose()
        gpgpu.utils.getVelocityTexture().dispose()
        composer.dispose()
        composerRef.current = null
        groupRef.current = null
        textGroupRef.current = null
        gpgpuRef.current = null
        meshRef.current = null
        textMeshRef.current = null
      }
    }

    const loader = new FontLoader()
    loader.load(
      '/norse_font/Norsebold.json',
      (font) => {
        if (cancelledRef.current) return
        createScene(font)
      },
      undefined,
      () => {
        // Fallback - create sphere-based particles
        if (cancelledRef.current) return
        const group = new THREE.Group()
        scene.add(group)
        groupRef.current = group
        
        const mesh = makeSphereMesh()
        meshRef.current = mesh
        group.add(mesh)
        
        const gpgpu = initEnhancedGPGPU(mesh, group, sizes)
        gpgpuRef.current = gpgpu
        
        const composer = new EffectComposer(gl)
        composer.addPass(new RenderPass(scene, camera))
        composer.addPass(
          new UnrealBloomPass(
            new THREE.Vector2(sizes.width, sizes.height),
            2.2,
            0.8,
            0.01
          )
        )
        composerRef.current = composer
      }
    )

    return () => {
      cancelledRef.current = true
      cleanupRef.current?.()
    }
  }, [gl, scene, camera, invalidate, initEnhancedGPGPU])

  useFrame((state) => {
    const gpgpu = gpgpuRef.current
    const group = groupRef.current
    const textGroup = textGroupRef.current
    const mesh = meshRef.current
    const textMesh = textMeshRef.current
    const composer = composerRef.current
    const mainLight = mainLightRef.current
    
    if (!gpgpu || !group || !textGroup || !composer) return

    const delta = state.clock.getDelta()
    timeRef.current += delta
    
    // Update group position to face camera
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    group.position.copy(camera.position).add(dir.multiplyScalar(DISTANCE_IN_FRONT))
    group.rotation.y += 0.002
    group.updateMatrixWorld(true)
    
    // Update text group position
    textGroup.position.copy(camera.position).add(dir.multiplyScalar(DISTANCE_IN_FRONT * 0.95))
    textGroup.rotation.copy(group.rotation)
    
    // Animate main light - Street lamp style sweeping motion
    // Light sweeps back and forth like a street lamp, maintaining 45° angle
    if (mainLight) {
      // Slow sweeping motion (like a street lamp)
      const sweepAngle = Math.sin(timeRef.current * 0.15) * 0.8
      const lightRadius = 800  // Distance from center
      const height = 800       // Height above text (maintains ~45° angle)
      
      // Position light in an arc
      mainLight.position.x = Math.sin(sweepAngle) * lightRadius
      mainLight.position.z = Math.cos(sweepAngle) * lightRadius * 0.5 + 400
      mainLight.position.y = height
      
      // Light always points at the text center
      mainLight.target.position.set(0, 0, 0)
      mainLight.target.updateMatrixWorld()
      
      // Slightly vary intensity for realistic lamp flicker
      mainLight.intensity = 8000 + Math.sin(timeRef.current * 3) * 200
    }
    
    // Raycast for hover detection
    raycasterRef.current.setFromCamera(mouseNDCRef.current, camera)
    const intersects = raycasterRef.current.intersectObject(mesh, false)
    
    // Update hover state
    isHoveringRef.current = intersects.length > 0
    
    // Smooth hover intensity transition
    targetHoverIntensityRef.current = isHoveringRef.current ? 1.0 : 0.0
    hoverIntensityRef.current += (targetHoverIntensityRef.current - hoverIntensityRef.current) * 0.1
    
    // Smooth text offset transition
    textOffsetRef.current.lerp(targetTextOffsetRef.current, 0.05)
    if (textMesh) {
      textMesh.position.copy(textOffsetRef.current)
      // Add subtle floating animation
      textMesh.position.y += Math.sin(timeRef.current) * 3
      // Scale up when hovering
      const targetScale = 1.0 + hoverIntensityRef.current * 0.05
      textMesh.scale.setScalar(textMesh.scale.x + (targetScale - textMesh.scale.x) * 0.1)
    }
    
    // Handle burst effect timing
    const now = performance.now()
    if (now - lastBurstTimeRef.current > nextBurstIntervalRef.current) {
      // Trigger burst
      burstActiveRef.current = 1.0
      lastBurstTimeRef.current = now
      nextBurstIntervalRef.current = BURST_INTERVAL_MIN + Math.random() * (BURST_INTERVAL_MAX - BURST_INTERVAL_MIN)
      
      // Random burst center near text edges
      const angle = Math.random() * Math.PI * 2
      const radius = 200 + Math.random() * 200
      burstCenterRef.current.set(
        Math.cos(angle) * radius,
        (Math.random() - 0.5) * 200,
        Math.sin(angle) * radius
      )
    }
    
    // Decay burst
    burstActiveRef.current *= 0.95
    if (burstActiveRef.current < 0.01) burstActiveRef.current = 0
    
    // Update GPGPU uniforms
    const uMouseVal = (gpgpu.uniforms.velocityUniforms.uMouse as { value: THREE.Vector3 }).value
    const uMouseActive = gpgpu.uniforms.velocityUniforms.uMouseActive as { value: number }
    
    if (intersects.length > 0) {
      hitPointRef.current.copy(intersects[0].point)
      group.worldToLocal(hitPointRef.current)
      uMouseVal.copy(hitPointRef.current)
      uMouseActive.value = 1
    } else {
      uMouseVal.set(1e6, 1e6, 1e6)
      uMouseActive.value = 0
    }
    
    // Update enhanced uniforms
    const uTime = gpgpu.material.uniforms.uTime as { value: number }
    if (uTime) uTime.value = timeRef.current
    
    const uHoverIntensity = gpgpu.material.uniforms.uHoverIntensity as { value: number }
    if (uHoverIntensity) uHoverIntensity.value = hoverIntensityRef.current
    
    const uBurstStrength = gpgpu.material.uniforms.uBurstStrength as { value: number }
    if (uBurstStrength) uBurstStrength.value = burstActiveRef.current
    
    // Update velocity shader uniforms
    const velUniforms = gpgpu.velocityVariable.material.uniforms
    if (velUniforms.uTime) velUniforms.uTime.value = timeRef.current
    if (velUniforms.uHoverIntensity) velUniforms.uHoverIntensity.value = hoverIntensityRef.current
    if (velUniforms.uBurstActive) velUniforms.uBurstActive.value = burstActiveRef.current
    if (velUniforms.uBurstCenter) velUniforms.uBurstCenter.value.copy(burstCenterRef.current)
    
    gpgpu.compute()
    gpgpu.material.uniforms.uPositionTexture.value =
      gpgpu.gpgpuCompute.getCurrentRenderTarget(gpgpu.positionVariable).texture
    gpgpu.material.uniforms.uVelocityTexture.value =
      gpgpu.gpgpuCompute.getCurrentRenderTarget(gpgpu.velocityVariable).texture

    composer.render()
    invalidate()
  }, 1)

  return null
}
