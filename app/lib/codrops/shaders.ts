/**
 * Codrops Dreamy Particles — shader source
 * Enhanced with metallic effects, light orbiting, and burst particles
 */

export const simFragment = /* glsl */ `
void main() {
  vec2 vUv = gl_FragCoord.xy / resolution.xy;

  vec3 position = texture2D( uCurrentPosition, vUv ).xyz;
  vec3 velocity = texture2D( uCurrentVelocity, vUv ).xyz;

  position += velocity;

  gl_FragColor = vec4( position, 1.);
}
`

export const simFragmentVelocity = /* glsl */ `
uniform sampler2D uOriginalPosition;
uniform vec3 uMouse;
uniform float uMouseSpeed;
uniform float uForce;
uniform float uTime;
uniform float uMouseActive;
uniform vec3 uLightPosition;
uniform float uHoverStrength;

void main() {
  vec2 vUv = gl_FragCoord.xy / resolution.xy;

  vec3 position = texture2D( uCurrentPosition, vUv ).xyz;
  vec3 original = texture2D( uOriginalPosition, vUv ).xyz;
  vec3 velocity = texture2D( uCurrentVelocity, vUv ).xyz;

  velocity *= uForce;

  vec3 direction = normalize( original - position );
  float dist = length( original - position );
  if( dist > 0.001 ) {
    float pull = 0.28 * min(1.0, dist * 0.04);
    velocity += direction * pull;
  }

  if( uMouseActive > 0.5 ) {
    float mouseDistance = distance( position, uMouse );
    float maxDistance = 50.0;
    if( mouseDistance < maxDistance ) {
      vec3 pushDirection = normalize( position - uMouse );
      float falloff = 1.0 - mouseDistance / maxDistance;
      float basePush = 1.5 * falloff;
      float speedPush = 1.2 * falloff * uMouseSpeed;
      float hoverPush = 0.8 * falloff * uHoverStrength;
      velocity += pushDirection * ( basePush + speedPush + hoverPush );
    }
  }

  float t = uTime * 0.15;
  velocity += 0.00005 * vec3(
    sin(position.x * 0.02 + t) + cos(position.z * 0.02 + t * 0.7),
    cos(position.y * 0.02 + t * 1.1),
    sin(position.z * 0.02 + t * 0.8) + cos(position.x * 0.02 + t)
  );

  float lightDist = distance(position, uLightPosition);
  if(lightDist < 120.0) {
    vec3 lightPush = normalize(position - uLightPosition) * 0.0005 * (1.0 - lightDist / 120.0);
    velocity += lightPush;
  }

  gl_FragColor = vec4(velocity, 1.);
}
`

export const vertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vPosition;
varying float vLightIntensity;
varying float vEdgeGlow;

uniform float uParticleSize;
uniform sampler2D uPositionTexture;
uniform vec3 uLightPosition;
uniform vec3 uCameraPosition;

void main() {
  vUv = uv;

  vec3 newpos = position;
  vec4 color = texture2D( uPositionTexture, vUv );
  newpos.xyz = color.xyz;
  vPosition = newpos;

  vec3 toLight = normalize(uLightPosition - newpos);
  vec3 toCamera = normalize(uCameraPosition - newpos);
  
  float lightDist = distance(newpos, uLightPosition);
  float lightFalloff = 1.0 / (1.0 + lightDist * 0.002);
  vLightIntensity = lightFalloff * 1.2;
  
  float edgeFactor = length(newpos.xy) / 500.0;
  vEdgeGlow = smoothstep(0.3, 1.0, edgeFactor);

  vec4 mvPosition = modelViewMatrix * vec4( newpos, 1.0 );

  gl_PointSize = ( uParticleSize / -mvPosition.z ) * (1.0 + vLightIntensity * 0.3);

  gl_Position = projectionMatrix * mvPosition;
}
`

export const fragmentShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vPosition;
varying float vLightIntensity;
varying float vEdgeGlow;

uniform sampler2D uVelocityTexture;
uniform vec3 uColor;
uniform float uMinAlpha;
uniform float uMaxAlpha;
uniform float uTime;
uniform float uBurstActive;
uniform vec3 uBurstPosition;

void main() {
  float center = length(gl_PointCoord - 0.5);
  if (center > 0.5) { discard; }

  vec3 velocity = texture2D( uVelocityTexture, vUv ).xyz * 100.0;
  float speed = length(velocity);
  float repelled = min(1.0, speed * 0.4);
  float velocityAlpha = mix(uMinAlpha, uMaxAlpha, repelled);
  
  vec3 baseColor = uColor;
  vec3 metallicHighlight = vec3(1.0, 0.92, 0.7);
  vec3 finalColor = mix(baseColor, metallicHighlight, vLightIntensity * 0.6);
  
  finalColor = mix(finalColor, finalColor * 2.5, repelled);
  
  vec3 edgeGlowColor = vec3(1.0, 0.85, 0.5);
  finalColor += edgeGlowColor * vEdgeGlow * 0.4;

  if(uBurstActive > 0.5) {
    float burstDist = distance(vPosition, uBurstPosition);
    if(burstDist < 150.0) {
      float burstGlow = (1.0 - burstDist / 150.0) * 0.8;
      finalColor += vec3(1.0, 0.85, 0.4) * burstGlow;
      velocityAlpha = min(1.0, velocityAlpha + burstGlow * 0.3);
    }
  }

  float glow = exp(-center * 3.0);
  finalColor += vec3(1.0, 0.9, 0.6) * glow * 0.2;
  
  float softEdge = smoothstep(0.5, 0.2, center);
  float trail = smoothstep(0.2, 0.5, center);
  finalColor *= (1.0 - trail * 0.4);

  gl_FragColor = vec4(finalColor, velocityAlpha * softEdge);
}
`

export const burstVertexShader = /* glsl */ `
attribute float aScale;
attribute float aLife;
attribute vec3 aVelocity;

varying float vLife;

uniform float uTime;
uniform float uBurstTime;

void main() {
  vLife = aLife;
  
  float age = uTime - uBurstTime;
  vec3 pos = position + aVelocity * age * 80.0;
  pos.y -= age * age * 30.0;
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = aScale * (400.0 / -mvPosition.z) * max(0.0, 1.0 - age * 0.6);
  gl_Position = projectionMatrix * mvPosition;
}
`

export const burstFragmentShader = /* glsl */ `
varying float vLife;

uniform vec3 uColor;
uniform float uTime;
uniform float uBurstTime;

void main() {
  float center = length(gl_PointCoord - 0.5);
  if (center > 0.5) discard;
  
  float age = uTime - uBurstTime;
  float alpha = max(0.0, 1.0 - age * 0.6) * vLife;
  
  vec3 color = uColor * 1.5;
  
  float glow = exp(-center * 4.0);
  color += vec3(1.0, 0.95, 0.7) * glow * 0.5;
  
  gl_FragColor = vec4(color, alpha);
}
`
