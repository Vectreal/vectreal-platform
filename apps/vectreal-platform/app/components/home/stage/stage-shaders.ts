import * as THREE from 'three'

import { BAYER4_GLSL, DITHER_CELL_PX } from '../../../lib/dither/dither'

/*
  The stage's GLSL, apart from the engine that drives it: the full-screen quad,
  the drawing overlay, the ground and the shadow blur.
*/

export const quadVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

/** Pass 1 renders normals and depth; the overlay finds the drawing in them, then composites. */
export const overlayUniforms = () => ({
	uPass: { value: 1 },
	tN: { value: null as THREE.Texture | null },
	tD: { value: null as THREE.Texture | null },
	uRes: { value: new THREE.Vector2() },
	uTexel: { value: new THREE.Vector2() },
	uNear: { value: 0.01 },
	uFar: { value: 100 },
	uInk: { value: new THREE.Vector3() },
	uAccent: { value: new THREE.Vector3() },
	uFade: { value: new THREE.Vector2(-1, -1) },
	uCell: { value: DITHER_CELL_PX },
	uVFade: { value: 0 },
	uSpan: { value: new THREE.Vector2(0, 1e5) },
	uReveal: { value: 0 },
	uLine: { value: 1.5 }
})

export const overlayFragment = /* glsl */ `
#include <packing>
uniform sampler2D tN; uniform sampler2D tD;
uniform vec2 uRes, uTexel; uniform float uNear, uFar;
uniform vec3 uInk, uAccent; uniform int uPass;
uniform vec2 uFade, uSpan; uniform float uCell, uVFade;
uniform float uReveal, uLine;
varying vec2 vUv;
${BAYER4_GLSL}
/*
  One dissolve for every edge the object can meet: toward the copy (uFade) and at
  the stage's top and bottom (uVFade), so where the canvas ends reads as a frame
  the drawing was set in rather than a crop.
*/
float kept(){
  float f = 1.0;
  if (uFade.y > uFade.x) { float a = clamp((gl_FragCoord.x - uFade.x) / (uFade.y - uFade.x), 0.0, 1.0); f = a * a * (3.0 - 2.0 * a); }
  if (uVFade > 0.0) { float e = clamp(min(gl_FragCoord.y, uRes.y - gl_FragCoord.y) / uVFade, 0.0, 1.0); f *= e * e * (3.0 - 2.0 * e); }
  return step(bayer4(floor(gl_FragCoord.xy / uCell)), f);
}
float z(vec2 uv){ float d = texture2D(tD, uv).x; return -perspectiveDepthToViewZ(d, uNear, uFar); }
vec3 n(vec2 uv){ return texture2D(tN, uv).xyz * 2.0 - 1.0; }
/* Two weights, as a draughtsman would: outlines in full ink, creases lighter. */
float edgeAt(vec2 uv){
  vec2 px = uLine * uTexel;
  vec2 a = uv + vec2(-px.x, -px.y), b = uv + vec2(px.x, px.y), c = uv + vec2(px.x, -px.y), d = uv + vec2(-px.x, px.y);
  if (texture2D(tD, a).x >= 1.0 && texture2D(tD, b).x >= 1.0 && texture2D(tD, c).x >= 1.0 && texture2D(tD, d).x >= 1.0) return 0.0;
  float gz = (abs(z(a) - z(b)) + abs(z(c) - z(d))) / max(z(uv), 1e-3);
  float gn = length(n(a) - n(b)) + length(n(c) - n(d));
  return max(smoothstep(0.03, 0.08, gz), smoothstep(0.9, 1.4, gn) * 0.45);
}
void main(){
  /* Below the front the object shows through. The soft edge sits wholly below the front, so at uReveal = 0 not one row is revealed. */
  float revealed = 1.0 - smoothstep(uReveal - 0.008, uReveal, vUv.y);
  float keep = kept();
  /* Pass 0 erases the rendered object wherever it is not yet revealed, leaving the page to show through. */
  if (uPass == 0) { gl_FragColor = vec4(0.0, 0.0, 0.0, max(1.0 - revealed, 1.0 - keep)); return; }
  /* Pass 1 inks the drawing. The edge buffer is twice the canvas resolution; four taps per pixel keep thin parts continuous. */
  vec2 h = 0.5 * uTexel;
  float edge = 0.25 * (edgeAt(vUv + vec2(-h.x, -h.y)) + edgeAt(vUv + vec2(h.x, -h.y)) + edgeAt(vUv + vec2(-h.x, h.y)) + edgeAt(vUv + vec2(h.x, h.y)));
  float ink = edge * (1.0 - revealed) * keep;
  /* The sweep front: the one accent, fading in and out, and only as wide as the object. */
  float front = (1.0 - smoothstep(0.0, 1.5, abs(vUv.y * uRes.y - uReveal * uRes.y))) * smoothstep(0.0, 0.08, uReveal) * (1.0 - smoothstep(0.92, 1.02, uReveal));
  front *= step(uSpan.x, gl_FragCoord.x) * step(gl_FragCoord.x, uSpan.y);
  gl_FragColor = vec4(mix(uInk * ink, uAccent, front), max(ink, front));   // premultiplied
}`

export const groundFragment = /* glsl */ `
varying vec2 vUv; uniform sampler2D uBake, uContact; uniform float uContactScale, uOpacity, uContactOpacity, uHasBake;
void main(){
  vec2 below = vec2(1.0 - vUv.x, vUv.y);   // both bakes look up from under the ground, so they see it mirrored
  float a = uHasBake > 0.5 ? texture2D(uBake, below).a * uOpacity : 0.0;
  vec2 cuv = (below - 0.5) * uContactScale + 0.5;   // the contact layer covers a tighter square, at finer texels
  float c = all(greaterThanEqual(cuv, vec2(0.0))) && all(lessThanEqual(cuv, vec2(1.0))) ? texture2D(uContact, cuv).a * uContactOpacity : 0.0;
  float fade = smoothstep(0.5, 0.3, length(vUv - 0.5));   // no square edge: the ground dissolves before the plane ends
  gl_FragColor = vec4(0.0, 0.0, 0.0, (1.0 - (1.0 - a) * (1.0 - c)) * fade);
}`

export const blurFragment = /* glsl */ `
varying vec2 vUv; uniform sampler2D t; uniform vec2 d;
void main(){ float s = 0.0; float w[5] = float[](0.227, 0.195, 0.122, 0.054, 0.016);
  s += texture2D(t, vUv).a * w[0];
  for (int i = 1; i < 5; i++) { s += (texture2D(t, vUv + d * float(i)).a + texture2D(t, vUv - d * float(i)).a) * w[i]; }
  gl_FragColor = vec4(0.0, 0.0, 0.0, s); }`
