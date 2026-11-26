/* GLSL for the synaptic tunnel. Points wrap endlessly along Z around the camera. */

const WRAP = /* glsl */ `
  uniform float uTime;
  uniform float uOffset;
  uniform float uLength;
  uniform float uGlitch;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;

  vec3 wrapTunnel(vec3 p, float r) {
    // Endless travel: push Z by the scroll offset and wrap inside [-L, 0]
    float z = mod(p.z + uOffset, uLength) - uLength;
    // Slow helical drift per particle
    float a = uTime * 0.03 * (r - 0.5);
    float c = cos(a), s = sin(a);
    vec3 q = vec3(c * p.x - s * p.y, s * p.x + c * p.y, z);
    // Q-Day glitch: horizontal tearing in bands
    float band = step(0.82, fract(sin(floor(q.y * 3.0) * 91.3 + floor(uTime * 12.0)) * 4375.5));
    q.x += band * uGlitch * (r - 0.5) * 2.4;
    return q;
  }

  float depthFade(float z) {
    // Fade in from the far end, fade out right before the camera
    return smoothstep(-uLength, -uLength * 0.6, z) * smoothstep(0.0, -3.0, z);
  }
`;

export const POINT_VERTEX = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute float aRand;
  uniform float uPixelRatio;
  ${WRAP}
  varying float vRand;
  varying float vFade;

  void main() {
    vec3 p = wrapTunnel(position, aRand);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // A few bright "synapse nodes"
    float node = step(0.965, aRand);
    float size = mix(1.4, 4.2, node) + aRand * 1.2;
    gl_PointSize = size * uPixelRatio * (30.0 / -mv.z);
    vRand = aRand;
    vFade = depthFade(p.z);
  }
`;

export const POINT_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uGlitch;
  uniform float uTime;
  varying float vRand;
  varying float vFade;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    vec3 col = mix(uColorA, uColorB, step(0.55, vRand));
    // Occasional crimson flicker during the glitch
    float flick = step(0.93, fract(vRand * 37.0 + uTime * 0.7)) * uGlitch;
    col = mix(col, vec3(0.88, 0.30, 0.47), flick);
    float twinkle = 0.65 + 0.35 * sin(uTime * 2.0 + vRand * 40.0);
    gl_FragColor = vec4(col, core * vFade * twinkle);
  }
`;

export const LINE_VERTEX = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute float aRand;
  ${WRAP}
  varying float vRand;
  varying float vFade;

  void main() {
    vec3 p = wrapTunnel(position, aRand);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    vRand = aRand;
    vFade = depthFade(p.z);
  }
`;

export const LINE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uTime;
  varying float vRand;
  varying float vFade;

  void main() {
    vec3 col = mix(uColorB, uColorA, step(0.5, vRand));
    float pulse = 0.35 + 0.65 * smoothstep(0.6, 1.0, sin(uTime * 1.3 + vRand * 25.0));
    gl_FragColor = vec4(col, vFade * pulse * 0.55);
  }
`;
