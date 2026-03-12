/**
 * Codrops Dreamy Particles — shader source (from codrops-dreamy-particles-main)
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
uniform vec3 uMouseRayStart;
uniform vec3 uMouseRayEnd;
uniform float uMouseSpeed;
uniform float uForce;
uniform float uTime;
uniform float uMouseActive;

void main() {
  vec2 vUv = gl_FragCoord.xy / resolution.xy;

  vec3 position = texture2D( uCurrentPosition, vUv ).xyz;
  vec3 original = texture2D( uOriginalPosition, vUv ).xyz;
  vec3 velocity = texture2D( uCurrentVelocity, vUv ).xyz;

  velocity *= uForce;

  // Attraction back to original shape — scale by distance to avoid overshoot and shaking (softer when near rest)
  vec3 direction = normalize( original - position );
  float dist = length( original - position );
  if( dist > 0.001 ) {
    float pull = 0.28 * min(1.0, dist * 0.04);
    velocity += direction * pull;
  }

  // Mouse repel along full ray through mesh — closest point on segment (entry to exit) so all faces react
  if( uMouseActive > 0.5 ) {
    vec3 seg = uMouseRayEnd - uMouseRayStart;
    float segLen = length(seg);
    vec3 closest = uMouseRayStart;
    if( segLen > 0.0001 ) {
      float t = clamp( dot( position - uMouseRayStart, seg ) / ( segLen * segLen ), 0.0, 1.0 );
      closest = uMouseRayStart + t * seg;
    }
    float mouseDistance = distance( position, closest );
    float maxDistance = 34.0;
    if( mouseDistance < maxDistance ) {
      vec3 pushDirection = normalize( position - closest );
      float falloff = 1.0 - mouseDistance / maxDistance;
      float basePush = 1.25 * falloff;
      float speedPush = 0.95 * falloff * uMouseSpeed;
      velocity += pushDirection * ( basePush + speedPush );
    }
  }

  // Very subtle ambient drift (reduced to avoid adding to shake)
  float t = uTime * 0.15;
  velocity += 0.00003 * vec3(
    sin(position.x * 0.02 + t) + cos(position.z * 0.02 + t * 0.7),
    cos(position.y * 0.02 + t * 1.1),
    sin(position.z * 0.02 + t * 0.8) + cos(position.x * 0.02 + t)
  );

  gl_FragColor = vec4(velocity, 1.);
}
`

export const vertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vPosition;
varying float vBrightness;

attribute float brightnessScale;

uniform float uParticleSize;
uniform sampler2D uPositionTexture;


void main() {
  vUv = uv;
  vBrightness = brightnessScale > 0.0 ? brightnessScale : 1.0;

  vec3 newpos = position;

  vec4 color = texture2D( uPositionTexture, vUv );


  newpos.xyz = color.xyz;

  vPosition = newpos;

  vec4 mvPosition = modelViewMatrix * vec4( newpos, 1.0 );

  gl_PointSize = ( uParticleSize / -mvPosition.z );

  gl_Position = projectionMatrix * mvPosition;
}
`

export const fragmentShader = /* glsl */ `
varying vec2 vUv;
varying float vBrightness;

uniform sampler2D uVelocityTexture;
uniform vec3 uColor;
uniform float uMinAlpha;
uniform float uMaxAlpha;


void main() {
  float center = length(gl_PointCoord - 0.5);

  vec3 velocity = texture2D( uVelocityTexture, vUv ).xyz * 100.0;
  float speed = length(velocity);
  float repelled = min(1.0, speed * 0.4);
  float velocityAlpha = mix(uMinAlpha, uMaxAlpha, repelled) * vBrightness;
  vec3 finalColor = mix(uColor, uColor * 1.85, repelled) * vBrightness;

  if (center > 0.5) { discard; }


  gl_FragColor = vec4(finalColor, velocityAlpha);
}
`
