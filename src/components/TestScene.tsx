import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// A simple rotating cube to test Three.js
export function RotatingCube() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // This runs every frame - we'll use it to rotate the cube
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.01;
      meshRef.current.rotation.y += 0.01;
    }
  });
  
  return (
    <mesh ref={meshRef}>
      {/* The shape - a box */}
      <boxGeometry args={[2, 2, 2]} />
      
      {/* The material - what it looks like */}
      <meshStandardMaterial color="#4a7c59" />
    </mesh>
  );
}

