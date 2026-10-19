import * as THREE from 'three'

/** The swell's drift, in noise units a second: the drafting terrain's idle rate. */
const DRIFT = 0.03
/** The floor only ever moves slowly, so 20 frames a second is enough for it. */
const FRAME_MS = 50

/** Uniforms the floor reads from the stage, so a theme or layout change reaches both. */
interface SharedUniforms {
	uInk: THREE.IUniform<THREE.Vector3>
	uAccent: THREE.IUniform<THREE.Vector3>
	uFade: THREE.IUniform<THREE.Vector2>
	uRes: THREE.IUniform<THREE.Vector2>
}

/**
 * The home hero's drafting floor, in the scene.
 *
 * It shares the model's camera, so it turns with the model and the shadow lies
 * on it in the same perspective; a 2D floor behind a freely orbiting model never
 * agreed with its shadow. Lines in world space, one step a third of the model's
 * radius, fading out radially so the floor never ends on an edge, and warming
 * to the brand under the object, where the key light would pool.
 *
 * It draws on a canvas of its own, under the stage's. The stage then composites
 * over it as it always has, untouched by it, and the swell's slow drift redraws
 * this one plane rather than the whole stage: the stage itself still draws
 * nothing at rest.
 */
export function createSceneFloor(
	stageCanvas: HTMLCanvasElement,
	shared: SharedUniforms,
	{ animate }: { animate: boolean }
) {
	const canvas = document.createElement('canvas')
	canvas.className = stageCanvas.className
	canvas.setAttribute('aria-hidden', 'true')
	canvas.style.pointerEvents = 'none'
	stageCanvas.before(canvas)

	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: true,
		alpha: true
	})
	renderer.setClearColor(0x000000, 0)

	const uniforms = {
		...shared,
		uCenter: { value: new THREE.Vector2() },
		uStep: { value: 1 },
		uReach: { value: 1 },
		uTime: { value: 0 }
	}
	const geometry = new THREE.PlaneGeometry(1, 1, 256, 256)
	const material = new THREE.ShaderMaterial({
		transparent: true,
		premultipliedAlpha: true,
		depthTest: false,
		depthWrite: false,
		uniforms,
		/*
		  Flat where the model stands, so it and its shadow sit on level ground;
		  further out the floor takes the drafting terrain's swell, rising to its
		  full height by the edge of the pool's reach and drifting toward the viewer.
		*/
		vertexShader: `
uniform vec2 uCenter;
uniform float uStep, uTime;
varying vec2 vW;
varying float vH;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), u.x), u.y);
}
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec2 q = (w.xz - uCenter) / uStep;
  float rise = smoothstep(6.0, 22.0, length(q));
  float h = 0.7 * vnoise(q * 0.09 + vec2(11.0, uTime)) + 0.3 * vnoise(q * 0.21 + vec2(-4.0, 1.6 * uTime)) - 0.5;
  vH = h * rise;
  w.y += vH * uStep * 3.2;
  vW = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
		fragmentShader: `
uniform vec3 uInk, uAccent;
uniform vec2 uCenter, uFade, uRes;
uniform float uStep, uReach;
varying vec2 vW;
varying float vH;
void main() {
  vec2 g = vW / uStep;
  vec2 w = fwidth(g);
  vec2 l = 1.0 - smoothstep(vec2(0.0), w * 1.2, abs(fract(g - 0.5) - 0.5));
  float line = max(l.x, l.y);
  float d = length(vW - uCenter) / uReach;
  float fade = 1.0 - smoothstep(0.45, 1.0, d);
  float pool = exp(-d * d * 40.0);
  /* A crest takes a little of the brand, as the terrain's do. */
  float crest = smoothstep(0.12, 0.26, vH) * 0.4;
  vec3 color = mix(uInk, uAccent, max(pool * 0.85, crest));
  /* Full bleed: the floor runs under the copy too, held low there so the type reads, and off every edge but the horizon. The pool stays out of the copy entirely. */
  float toCopy = uFade.y > uFade.x ? smoothstep(uFade.y - 0.1 * uRes.x, uFade.y + 0.3 * uRes.x, gl_FragCoord.x) : 1.0;
  float toFoot = smoothstep(0.0, 0.1 * uRes.y, gl_FragCoord.y);
  float toTop = 1.0 - smoothstep(0.7 * uRes.y, uRes.y, gl_FragCoord.y);
  fade *= mix(0.12, 1.0, toCopy) * toFoot * toTop;
  pool *= toFoot * toCopy;
  float a = line * fade * (0.22 + 0.4 * pool) + pool * 0.14;
  gl_FragColor = vec4(color * a, a);
}`
	})
	const plane = new THREE.Mesh(geometry, material)
	plane.rotation.x = -Math.PI / 2
	const scene = new THREE.Scene()
	scene.add(plane)

	// The stage's camera, with the far plane the floor needs: it runs to the horizon, well past what the stage's edge pass can keep in depth precision.
	const view = new THREE.PerspectiveCamera()
	let camera: THREE.PerspectiveCamera | null = null
	function render(from: THREE.PerspectiveCamera) {
		camera = from
		view.copy(from)
		view.far = from.far * 6
		view.updateProjectionMatrix()
		renderer.render(scene, view)
	}

	let raf = 0
	let onScreen = false
	const visibility = new IntersectionObserver(([entry]) => {
		onScreen = entry.isIntersecting
	})
	if (animate) {
		visibility.observe(canvas)
		let last = 0
		const tick = (now: number) => {
			raf = requestAnimationFrame(tick)
			if (now - last < FRAME_MS) return
			const dt = last ? Math.min(now - last, 100) / 1000 : 0
			last = now
			if (!onScreen || document.hidden || !camera) return
			uniforms.uTime.value += DRIFT * dt
			render(camera)
		}
		raf = requestAnimationFrame(tick)
	}

	return {
		render,
		/** Matches the stage canvas, pixel for pixel, so the shared screen-space uniforms mean the same here. */
		resize(width: number, height: number, pixelRatio: number) {
			renderer.setPixelRatio(pixelRatio)
			renderer.setSize(width, height)
		},
		/** Centres the floor under the model and scales it to it. */
		place(center: THREE.Vector3, radius: number) {
			plane.scale.setScalar(radius * 48)
			plane.position.set(center.x, 0, center.z)
			uniforms.uCenter.value.set(center.x, center.z)
			uniforms.uStep.value = radius / 3
			uniforms.uReach.value = radius * 22
		},
		dispose() {
			cancelAnimationFrame(raf)
			visibility.disconnect()
			geometry.dispose()
			material.dispose()
			renderer.dispose()
			// The canvas is this module's own, so its context goes with it now rather than at collection: browsers keep only about 16 live.
			renderer.forceContextLoss()
			canvas.remove()
		}
	}
}
