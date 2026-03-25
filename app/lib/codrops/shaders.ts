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
      float speedPush = 2.4 * falloff * uMouseSpeed;
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
varying float vProgressCoord;

attribute float brightnessScale;
attribute float progressCoord;

uniform float uParticleSize;
uniform sampler2D uPositionTexture;


void main() {
  vUv = uv;
  vBrightness = brightnessScale > 0.0 ? brightnessScale : 1.0;
  vProgressCoord = progressCoord;

  vec3 newpos = position;

  vec4 color = texture2D( uPositionTexture, vUv );


  newpos.xyz = color.xyz;

  vPosition = newpos;

  vec4 mvPosition = modelViewMatrix * vec4( newpos, 1.0 );

  /* Uniform point size — whole title scales on the CPU via group.scale */
  gl_PointSize = max(1.0, uParticleSize / -mvPosition.z);

  gl_Position = projectionMatrix * mvPosition;
}
`

export const fragmentShader = /* glsl */ `
varying vec2 vUv;
varying float vBrightness;
varying float vProgressCoord;

uniform sampler2D uVelocityTexture;
uniform vec3 uColor;
uniform vec3 uIdleLow;
uniform vec3 uCursorColor;
uniform float uMinAlpha;
uniform float uMaxAlpha;
uniform float uProgress;
uniform float uIdleTime;


void main() {
  if (vProgressCoord > uProgress) { discard; }
  float center = length(gl_PointCoord - 0.5);

  vec3 velocity = texture2D( uVelocityTexture, vUv ).xyz * 100.0;
  float speed = length(velocity);
  float repelled = min(1.0, speed * 0.4);
  float velocityAlpha = mix(uMinAlpha, uMaxAlpha, repelled) * vBrightness;
  /* Idle: pulse uIdleLow → uColor. Cursor repel: vivid uCursorColor */
  float interact = smoothstep(0.012, 0.09, repelled);
  float metalPulse = 0.5 + 0.5 * sin(uIdleTime * 1.05);
  vec3 idleBase = mix(uIdleLow, uColor, metalPulse);
  float punch = mix(1.0, 1.14, interact);
  vec3 accent = uCursorColor * (1.0 + 0.22 * interact);
  vec3 baseColor = mix(idleBase, accent, interact) * vBrightness * punch;
  vec3 finalColor = baseColor;

  /* Subtle alpha shimmer so idle isn’t only a colour cross-fade */
  float w2 = sin(uIdleTime * 0.85 + 1.1);
  velocityAlpha *= (0.94 + 0.06 * (0.5 + 0.5 * w2));

  if (center > 0.5) { discard; }


  gl_FragColor = vec4(finalColor, velocityAlpha);
}
`
