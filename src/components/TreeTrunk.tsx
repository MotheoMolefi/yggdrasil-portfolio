import * as THREE from 'three';

export function TreeTrunk() {
  return (
    <group>
      {/* Main trunk - a cylinder pointing upward */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[
          0.5,  // top radius
          0.6,  // bottom radius (slightly wider at base)
          5,    // height
          16    // segments (smoothness)
        ]} />
        <meshStandardMaterial 
          color="#3d2817"  // bark brown
          roughness={0.9}   // not shiny
          metalness={0.1}   // slightly metallic
        />
      </mesh>
      
      {/* Root ball at the base */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial 
          color="#2a1810"  // darker brown
          roughness={0.95}
        />
      </mesh>
    </group>
  );
}

