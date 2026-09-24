import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { BAYER4_GLSL, DITHER_CELL_PX } from '../../../lib/dither/dither'

/**
 * The hero's stage: a model drawn as a technical drawing, swept into its
 * rendered self, then turned and handed to the reader.
 *
 * Plain three.js rather than `@vctrl/viewer`, deliberately. This stage replaces
 * nearly everything the viewer owns - the camera (framed by a view offset into a
 * box the page's CSS places), the render loop (a normal and depth pre-pass, then
 * two composited passes), the ground shadow and the frame loop - so hosting it in
 * the viewer would mean overriding each of those from a child.
 *
 * The page's CSS owns layout. The engine reads the frame box and the copy's edge
 * back from the DOM, so the server-rendered poster and the live drawing always
 * share one frame.
 */

export interface StageElements {
	stage: HTMLElement
	frame: HTMLElement
	canvas: HTMLCanvasElement
	/** Text set beside the stage: where the model reaches under it, it dissolves. */
	copy?: HTMLElement
	/** Where the drawing's dimension lines go, and its scale note. A stage without them draws none. */
	dims?: SVGSVGElement
	scale?: HTMLElement
}

export interface StageOptions {
	reducedMotion: boolean
	/** Bake mode: draw the elevation only, whole and unfaded, for a screenshot. */
	posterMode?: boolean
	/** Dissolve the model into the page in a band at the stage's top and bottom edges. On by default. */
	edgeFade?: boolean
}

/*
  The ground shadow is two layers, both stored as density (alpha) so strength is
  applied live and tuning never needs a re-bake:
  1. A soft directional shadow accumulated from jittered lights. The hero model's
     ships as a baked image; any other file bakes it once on arrival.
  2. A contact layer rendered from under the ground and blurred, standing in for
     ground occlusion.
  The key is the light the model is shaded by, so the cast shadow falls away from
  the viewer, as in a front-lit product shot. What grounds the object is the
  contact layer: a short reach (only what really touches, not a lens hovering a
  few millimetres up), blurred wide enough to show past the base. A wide blur is
  built from many narrow passes: few wide ones leave visible steps.
*/
const SHADOW = {
	samples: 96,
	ambient: 0.3,
	skyLow: 0.5,
	key: new THREE.Vector3(3, 5, 4),
	jitter: 2.2,
	planeScale: 2.5,
	opacity: 0.4,
	contactScale: 1.3,
	contactReach: 0.06,
	contactOpacity: 1,
	contactBlur: 4,
	contactPasses: 10
}

/** The sequence's timings, in milliseconds. */
const TIMING = { sweep: 2600, turn: 1500 }

/** Drawn square to the sheet, then turned high enough to see the ground its shadow lies on. */
const ELEVATION = { az: 0.03, el: 0.05 }
const OBJECT = { az: 0.5, el: 0.3 }

const quadVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

/** Pass 1 renders normals and depth; the overlay finds the drawing in them, then composites. */
const overlayUniforms = () => ({
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

const overlayFragment = /* glsl */ `
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

const groundFragment = /* glsl */ `
varying vec2 vUv; uniform sampler2D uBake, uContact; uniform float uContactScale, uOpacity, uContactOpacity, uHasBake;
void main(){
  vec2 below = vec2(1.0 - vUv.x, vUv.y);   // both bakes look up from under the ground, so they see it mirrored
  float a = uHasBake > 0.5 ? texture2D(uBake, below).a * uOpacity : 0.0;
  vec2 cuv = (below - 0.5) * uContactScale + 0.5;   // the contact layer covers a tighter square, at finer texels
  float c = all(greaterThanEqual(cuv, vec2(0.0))) && all(lessThanEqual(cuv, vec2(1.0))) ? texture2D(uContact, cuv).a * uContactOpacity : 0.0;
  float fade = smoothstep(0.5, 0.3, length(vUv - 0.5));   // no square edge: the ground dissolves before the plane ends
  gl_FragColor = vec4(0.0, 0.0, 0.0, (1.0 - (1.0 - a) * (1.0 - c)) * fade);
}`

const blurFragment = /* glsl */ `
varying vec2 vUv; uniform sampler2D t; uniform vec2 d;
void main(){ float s = 0.0; float w[5] = float[](0.227, 0.195, 0.122, 0.054, 0.016);
  s += texture2D(t, vUv).a * w[0];
  for (int i = 1; i < 5; i++) { s += (texture2D(t, vUv + d * float(i)).a + texture2D(t, vUv - d * float(i)).a) * w[i]; }
  gl_FragColor = vec4(0.0, 0.0, 0.0, s); }`

/** Resolves a CSS color (tokens are oklch and color-mix) through a 2D canvas, to sRGB 0..1. */
function cssColor(probe: CanvasRenderingContext2D, css: string): THREE.Vector3 {
	probe.clearRect(0, 0, 1, 1)
	probe.fillStyle = css
	probe.fillRect(0, 0, 1, 1)
	const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
	return new THREE.Vector3(r / 255, g / 255, b / 255)
}

export function createStageEngine(el: StageElements, options: StageOptions) {
	const { reducedMotion, posterMode = false, edgeFade = true } = options
	const renderer = new THREE.WebGLRenderer({
		canvas: el.canvas,
		antialias: true,
		alpha: true,
		preserveDrawingBuffer: posterMode
	})
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
	renderer.toneMapping = THREE.AgXToneMapping
	renderer.toneMappingExposure = 1.05
	renderer.setClearColor(0x000000, 0)
	renderer.shadowMap.enabled = true
	renderer.shadowMap.type = THREE.PCFShadowMap // the jittered samples supply the softness

	const scene = new THREE.Scene()
	const pmrem = new THREE.PMREMGenerator(renderer)
	const room = new RoomEnvironment()
	scene.environment = pmrem.fromScene(room, 0.04).texture
	room.dispose()
	pmrem.dispose()
	const key = new THREE.DirectionalLight(0xffffff, 1.6)
	key.position.copy(SHADOW.key)
	scene.add(key)

	// A long lens flattens perspective, so the elevation reads square to the sheet.
	const camera = new THREE.PerspectiveCamera(20, 4 / 3, 0.01, 100)
	const controls = new OrbitControls(camera, el.canvas)
	controls.enableZoom = false
	controls.enablePan = false
	controls.enableDamping = true
	controls.enabled = false
	/*
	  OrbitControls claims every touch gesture on the canvas, and the canvas spans
	  the fold, so a phone could not scroll past the hero. Vertical swipes go back
	  to the page; a horizontal drag still turns the model.
	*/
	el.canvas.style.touchAction = 'pan-y'

	const ground = new THREE.Mesh(
		new THREE.PlaneGeometry(1, 1),
		new THREE.ShaderMaterial({
			transparent: true,
			depthWrite: false,
			uniforms: {
				uBake: { value: null as THREE.Texture | null },
				uHasBake: { value: 0 },
				uContact: { value: null as THREE.Texture | null },
				uContactScale: { value: 1 },
				uOpacity: { value: SHADOW.opacity },
				uContactOpacity: { value: SHADOW.contactOpacity }
			},
			vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
			fragmentShader: groundFragment
		})
	)
	ground.rotation.x = -Math.PI / 2
	ground.visible = false
	scene.add(ground)

	const passCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
	const fsQuad = (material: THREE.Material) => {
		const quad = new THREE.Scene()
		quad.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material))
		return quad
	}

	const blurPass = new THREE.ShaderMaterial({
		uniforms: {
			t: { value: null as THREE.Texture | null },
			d: { value: new THREE.Vector2() }
		},
		vertexShader: quadVert,
		depthTest: false,
		fragmentShader: blurFragment
	})
	const blurScene = fsQuad(blurPass)
	function blurDensity(
		rt: THREE.WebGLRenderTarget,
		texels: number,
		passes = 2
	) {
		const tmp = rt.clone()
		for (let i = 0; i < passes; i++) {
			blurPass.uniforms.t.value = rt.texture
			blurPass.uniforms.d.value.set(texels / rt.width, 0)
			renderer.setRenderTarget(tmp)
			renderer.render(blurScene, passCam)
			blurPass.uniforms.t.value = tmp.texture
			blurPass.uniforms.d.value.set(0, texels / rt.height)
			renderer.setRenderTarget(rt)
			renderer.render(blurScene, passCam)
		}
		renderer.setRenderTarget(null)
		tmp.dispose()
	}

	/*
	  The bake looks up from under the ground, as the contact pass does. The
	  receiver is opaque and fills the view, and it is always nearer than the
	  model, so only the shadow is written. (Hiding the model by layers does not
	  work: three draws only casters visible to the rendering camera into the
	  shadow map.) The samples are spread evenly, a spiral over the key's disc and
	  the high sky, so the same model always bakes the same image.
	*/
	function bakeDirectional(
		center: THREE.Vector3,
		extent: number,
		radius: number
	) {
		const res = 1024
		const tmp = new THREE.WebGLRenderTarget(res, res)
		const acc = new THREE.WebGLRenderTarget(res, res, {
			type: THREE.HalfFloatType
		})
		const receiver = new THREE.Mesh(
			new THREE.PlaneGeometry(extent, extent),
			new THREE.ShadowMaterial({
				opacity: 1,
				transparent: false,
				side: THREE.DoubleSide
			})
		)
		receiver.rotation.x = -Math.PI / 2
		receiver.position.set(center.x, 0, center.z)
		receiver.receiveShadow = true
		scene.add(receiver)
		const under = new THREE.OrthographicCamera(
			-extent / 2,
			extent / 2,
			extent / 2,
			-extent / 2,
			0,
			1
		)
		under.up.set(0, 0, -1)
		under.position.set(center.x, -0.5, center.z)
		under.lookAt(center.x, 1, center.z)
		const light = new THREE.DirectionalLight(0xffffff, 1)
		light.castShadow = true
		light.shadow.mapSize.set(2048, 2048)
		light.shadow.bias = -0.001
		light.shadow.normalBias = 0.02
		const sc = light.shadow.camera
		sc.left = sc.bottom = -radius * 1.3
		sc.right = sc.top = radius * 1.3
		sc.near = 0.01
		sc.far = radius * 8
		sc.updateProjectionMatrix()
		light.target.position.set(center.x, 0, center.z)
		scene.add(light, light.target)
		const add = new THREE.ShaderMaterial({
			uniforms: { t: { value: tmp.texture }, w: { value: 1 / SHADOW.samples } },
			vertexShader: quadVert,
			fragmentShader: `varying vec2 vUv; uniform sampler2D t; uniform float w; void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, texture2D(t, vUv).a * w); }`,
			blending: THREE.CustomBlending,
			blendSrc: THREE.OneFactor,
			blendDst: THREE.OneFactor,
			blendSrcAlpha: THREE.OneFactor,
			blendDstAlpha: THREE.OneFactor,
			depthTest: false
		})
		const addScene = fsQuad(add)
		const golden = Math.PI * (3 - Math.sqrt(5))
		const nSky = Math.round(SHADOW.samples * SHADOW.ambient)
		const nKey = SHADOW.samples - nSky
		renderer.setRenderTarget(acc)
		renderer.setClearColor(0, 0)
		renderer.clear()
		for (let i = 0; i < SHADOW.samples; i++) {
			let dir: THREE.Vector3
			if (i < nKey) {
				const r = Math.sqrt((i + 0.5) / nKey) * SHADOW.jitter
				const a = i * golden
				dir = SHADOW.key
					.clone()
					.add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r))
					.normalize()
			} else {
				const k = i - nKey
				const y = 1 - ((1 - SHADOW.skyLow) * (k + 0.5)) / nSky
				const a = k * golden
				const h = Math.sqrt(1 - y * y)
				dir = new THREE.Vector3(Math.cos(a) * h, y, Math.sin(a) * h)
			}
			light.position.set(center.x, 0, center.z).addScaledVector(dir, radius * 4)
			renderer.setRenderTarget(tmp)
			renderer.clear()
			renderer.render(scene, under)
			renderer.setRenderTarget(acc)
			renderer.autoClear = false
			renderer.render(addScene, passCam)
			renderer.autoClear = true
		}
		renderer.setRenderTarget(null)
		scene.remove(receiver, light, light.target)
		tmp.dispose()
		receiver.geometry.dispose()
		add.dispose()
		blurDensity(acc, 3) // the sky samples are few; unblurred, each one leaves a ghost copy of the shadow
		return acc
	}

	/* Contact: look up from the ground; anything within reach darkens with nearness, then blur. */
	function bakeContact(center: THREE.Vector3, extent: number, reach: number) {
		const rt = new THREE.WebGLRenderTarget(1024, 1024, {
			type: THREE.HalfFloatType
		})
		const cam = new THREE.OrthographicCamera(
			-extent / 2,
			extent / 2,
			extent / 2,
			-extent / 2,
			0,
			reach
		)
		cam.up.set(0, 0, -1)
		cam.position.set(center.x, -reach * 0.001, center.z)
		cam.lookAt(center.x, 1, center.z)
		const near = new THREE.ShaderMaterial({
			side: THREE.DoubleSide,
			uniforms: { uReach: { value: reach } },
			vertexShader: `varying float vH; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vH = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
			fragmentShader: `varying float vH; uniform float uReach; void main(){ float d = clamp(1.0 - vH / uReach, 0.0, 1.0); gl_FragColor = vec4(0.0, 0.0, 0.0, d * d); }`
		})
		renderer.setRenderTarget(rt)
		renderer.setClearColor(0, 0)
		renderer.clear()
		scene.overrideMaterial = near
		renderer.render(scene, cam)
		scene.overrideMaterial = null
		renderer.setRenderTarget(null)
		near.dispose()
		blurDensity(rt, SHADOW.contactBlur, SHADOW.contactPasses)
		return rt
	}

	/** Density out to a PNG data URL, for the bake script: 512px, the size a soft density loses nothing at. */
	function densityPng(rt: THREE.WebGLRenderTarget) {
		const size = 512
		const out = new THREE.WebGLRenderTarget(size, size)
		const copy = new THREE.ShaderMaterial({
			uniforms: { t: { value: rt.texture } },
			vertexShader: quadVert,
			depthTest: false,
			fragmentShader: `varying vec2 vUv; uniform sampler2D t; void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, texture2D(t, vUv).a); }`
		})
		renderer.setRenderTarget(out)
		renderer.render(fsQuad(copy), passCam)
		renderer.setRenderTarget(null)
		const px = new Uint8Array(size * size * 4)
		renderer.readRenderTargetPixels(out, 0, 0, size, size, px)
		out.dispose()
		copy.dispose()
		const c = document.createElement('canvas')
		c.width = c.height = size
		const ctx = c.getContext('2d')!
		const img = ctx.createImageData(size, size)
		for (let y = 0; y < size; y++)
			img.data.set(
				px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4),
				y * size * 4
			) // GL rows run bottom-up
		ctx.putImageData(img, 0, 0)
		return c.toDataURL('image/png')
	}

	const normalMat = new THREE.MeshNormalMaterial()
	let rtN: THREE.WebGLRenderTarget | null = null

	const uniforms = overlayUniforms()
	const overlay = new THREE.ShaderMaterial({
		transparent: true,
		premultipliedAlpha: true,
		depthTest: false,
		depthWrite: false,
		uniforms,
		vertexShader: quadVert,
		fragmentShader: overlayFragment
	})
	/*
	  Same shader and the same uniform objects, so every update reaches both; this
	  one runs first, as the erase pass. "Over" cannot erase (it always leaves alpha
	  at 1 where the source is opaque), so this pass scales the destination and adds
	  nothing.
	*/
	const erase = new THREE.ShaderMaterial({
		transparent: true,
		depthTest: false,
		depthWrite: false,
		uniforms: { ...uniforms, uPass: { value: 0 } },
		vertexShader: quadVert,
		fragmentShader: overlayFragment,
		blending: THREE.CustomBlending,
		blendSrc: THREE.ZeroFactor,
		blendDst: THREE.OneMinusSrcAlphaFactor,
		blendSrcAlpha: THREE.ZeroFactor,
		blendDstAlpha: THREE.OneMinusSrcAlphaFactor
	})
	const quadScene = new THREE.Scene()
	const eraseQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), erase)
	eraseQuad.renderOrder = 0
	const inkQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), overlay)
	inkQuad.renderOrder = 1
	quadScene.add(eraseQuad, inkQuad)

	const probe = document
		.createElement('canvas')
		.getContext('2d', { willReadFrequently: true })!
	probe.canvas.width = probe.canvas.height = 1
	/* The overlay writes straight to the canvas, so it takes the tokens' sRGB values as they render. */
	function readTheme() {
		const style = getComputedStyle(el.stage)
		uniforms.uInk.value = cssColor(
			probe,
			style.getPropertyValue('--foreground')
		)
		uniforms.uAccent.value = cssColor(probe, style.getPropertyValue('--orange'))
		request()
	}

	let model: THREE.Object3D | null = null
	let bounds: THREE.Box3 | null = null
	let target = new THREE.Vector3()
	let dist = 1
	let turned = false
	let frameZoom = 1
	let frameY = 0
	/*
	  The sample is framed tight, to land exactly on its baked poster: its
	  bounding sphere is loose, so a sphere fit leaves it small. A dropped file has
	  no poster and any shape, so it is framed whole, its sphere inside the frame.
	*/
	let matchPoster = true

	function pose({ az, el: elev }: { az: number; el: number }) {
		camera.position
			.set(
				Math.sin(az) * Math.cos(elev),
				Math.sin(elev),
				Math.cos(az) * Math.cos(elev)
			)
			.multiplyScalar(dist)
			.add(target)
		camera.lookAt(target)
	}

	/* Bake mode draws the drawing alone, except while baking the rendered object. */
	let bakingObject = false
	function frame() {
		if (!model || !rtN) return
		controls.update()
		ground.visible = false
		scene.overrideMaterial = normalMat
		renderer.setRenderTarget(rtN)
		renderer.clear()
		renderer.render(scene, camera)
		scene.overrideMaterial = null
		ground.visible = true
		renderer.setRenderTarget(null)
		renderer.clear()
		if (!posterMode || bakingObject) renderer.render(scene, camera)
		renderer.autoClear = false
		renderer.render(quadScene, passCam)
		renderer.autoClear = true
		listeners.frame?.()
	}
	let raf = 0
	let disposed = false
	function request() {
		if (!raf)
			raf = requestAnimationFrame(() => {
				raf = 0
				frame()
			})
	}
	controls.addEventListener('change', request)

	/*
	  The frame box comes from the page's CSS; the camera is fitted to it. Contain,
	  like object-fit: the model sits in that 4:3 box however the stage is shaped,
	  and the poster sits in the same box, so the baked drawing and the live one
	  line up exactly.
	*/
	function resize() {
		const rect = el.stage.getBoundingClientRect()
		const w = Math.ceil(rect.width)
		const h = Math.ceil(rect.height)
		if (!w || !h) return
		renderer.setSize(w, h) // whole pixels: a canvas stretched over a fractional height leaves a dark fringe
		camera.aspect = w / h
		const style = getComputedStyle(el.stage)
		frameZoom = parseFloat(style.getPropertyValue('--frame-zoom')) || 1
		frameY = parseFloat(style.getPropertyValue('--frame-y')) || 0
		fitCamera()

		// Where the model reaches under the copy it dissolves, over the same zone the poster's mask fades.
		const copy = el.copy?.getBoundingClientRect()
		const beside =
			!!copy &&
			!posterMode &&
			copy.bottom > rect.top + 1 &&
			copy.right < rect.left + w / 2
		const copyRight = (copy?.right ?? 0) - rect.left
		const dpr = renderer.getPixelRatio()
		uniforms.uFade.value.set(
			beside ? (copyRight - 24) * dpr : -1,
			beside ? (copyRight + 96) * dpr : -1
		)
		uniforms.uCell.value = DITHER_CELL_PX * dpr
		uniforms.uVFade.value = posterMode || !edgeFade ? 0 : 40 * dpr // a tight band: the frame, not a vignette
		uniforms.uRes.value.set(w * dpr, h * dpr)

		const ss = Math.min(2, 4096 / (w * dpr))
		const ew = Math.round(w * dpr * ss)
		const eh = Math.round(h * dpr * ss)
		rtN?.dispose()
		rtN = new THREE.WebGLRenderTarget(ew, eh, {
			depthTexture: new THREE.DepthTexture(ew, eh),
			type: THREE.HalfFloatType
		})
		uniforms.tN.value = rtN.texture
		uniforms.tD.value = rtN.depthTexture
		uniforms.uTexel.value.set(1 / ew, 1 / eh)
		if (model && !turned) drawDims()
		request()
	}

	/*
	  Points the camera at the frame box: zoomed so the model's sphere spans it,
	  and offset so the sphere's center sits on the box's. Apart from resize, so a
	  frame that moves can be followed each frame without rebuilding any buffer.
	*/
	function fitCamera() {
		const rect = el.stage.getBoundingClientRect()
		const w = Math.ceil(rect.width)
		const h = Math.ceil(rect.height)
		if (!w || !h) return
		const box = el.frame.getBoundingClientRect()
		const cx = box.left + box.width / 2 - rect.left
		const cy = box.top + box.height / 2 - rect.top
		// A poster's framing is set by its height. A sphere is round, so without one it fits the box's shorter side.
		const span = matchPoster
			? frameZoom * box.height
			: Math.min(box.width, box.height)
		camera.zoom = span / h
		camera.setViewOffset(
			w,
			h,
			w / 2 - cx,
			h / 2 - cy + box.height * (matchPoster ? frameY : 0),
			w,
			h
		)
		camera.updateProjectionMatrix()
	}

	/* Dimension lines, measured off the model's real bounds and projected into the sheet. */
	function drawDims() {
		if (!bounds) return
		const w = el.stage.clientWidth
		const h = el.stage.clientHeight
		const p = (v: THREE.Vector3) => {
			const q = v.clone().project(camera)
			return [((q.x + 1) / 2) * w, ((1 - q.y) / 2) * h] as const
		}
		const { min, max } = bounds
		const size = bounds.getSize(new THREE.Vector3())
		const c = bounds.getCenter(new THREE.Vector3())
		const long = size.x >= size.z ? 'x' : 'z'
		const a =
			long === 'x'
				? new THREE.Vector3(min.x, 0, c.z)
				: new THREE.Vector3(c.x, 0, max.z)
		const b =
			long === 'x'
				? new THREE.Vector3(max.x, 0, c.z)
				: new THREE.Vector3(c.x, 0, min.z)
		const top = a.clone()
		top.y = max.y
		const [ax, ay] = p(a)
		const [bx, by] = p(b)
		const [tx, ty] = p(top)
		const off = 22
		// Millimetres, as on a technical drawing. Outside a plausible product size the file's units are suspect, so no unit is claimed.
		const unit = (m: number) =>
			m > 0.01 && m < 50
				? `${Math.round(m * 1000).toLocaleString('en-US')} mm`
				: `${m.toFixed(2)} units`
		const real = long === 'x' ? size.x : size.z
		const lines = [
			[ax, ay + off, bx, by + off, unit(real), 'h'],
			[ax - off, ay, tx - off, ty, unit(size.y), 'v']
		] as const
		let markup = ''
		for (const [x1, y1, x2, y2, label, kind] of lines) {
			const len = Math.hypot(x2 - x1, y2 - y1)
			markup += `<line class="draw" style="--len:${len}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`
			const tick = (x: number, y: number) =>
				kind === 'h'
					? `<line x1="${x}" y1="${y - 5}" x2="${x}" y2="${y + 5}"/>`
					: `<line x1="${x - 5}" y1="${y}" x2="${x + 5}" y2="${y}"/>`
			markup += tick(x1, y1) + tick(x2, y2)
			const mx = (x1 + x2) / 2
			const my = (y1 + y2) / 2
			markup +=
				kind === 'h'
					? `<text x="${mx}" y="${my + 16}" text-anchor="middle">${label}</text>`
					: `<text x="${mx - 10}" y="${my}" text-anchor="middle" transform="rotate(-90 ${mx - 10} ${my})">${label}</text>`
		}
		// Numbers only: nothing from the file itself is written here.
		if (el.dims) el.dims.innerHTML = markup

		// The sweep front spans the model's projected width plus the 16px the loading front overhangs by.
		let x0 = Infinity
		let x1 = -Infinity
		for (let i = 0; i < 8; i++) {
			const [x] = p(
				new THREE.Vector3(
					i & 1 ? max.x : min.x,
					i & 2 ? max.y : min.y,
					i & 4 ? max.z : min.z
				)
			)
			x0 = Math.min(x0, x)
			x1 = Math.max(x1, x)
		}
		const dpr = renderer.getPixelRatio()
		uniforms.uSpan.value.set((x0 - 16) * dpr, (x1 + 16) * dpr)

		// Scale, honestly: CSS pixels at 96 dpi against the model's real length. A small object is drawn larger than life, and a drawing says so the other way round: 2:1, not 1:0.5.
		const pxLen = (Math.hypot(bx - ax, by - ay) * 0.2646) / 1000
		if (!el.scale) return
		if (real > 0.01 && real < 50) {
			const r = real / pxLen
			el.scale.textContent =
				r >= 1 ? `Scale 1:${Math.round(r)}` : `Scale ${Math.round(1 / r)}:1`
		} else el.scale.textContent = ''
	}

	/** Frees what a model holds on the GPU; a visitor can drop file after file. */
	function release(object: THREE.Object3D) {
		object.traverse((o) => {
			const mesh = o as THREE.Mesh
			if (!mesh.isMesh) return
			mesh.geometry.dispose()
			for (const material of [mesh.material].flat()) {
				for (const value of Object.values(material))
					if (value instanceof THREE.Texture) value.dispose()
				material.dispose()
			}
		})
	}

	function place(object: THREE.Object3D, bakedShadow: THREE.Texture | null) {
		if (model) {
			scene.remove(model)
			release(model)
		}
		model = object
		scene.add(model)
		// Precise: from the vertices, not each part's own box. Rotated parts overshoot their boxes, which lifts the model off the ground and inflates the dimensions.
		const box = new THREE.Box3().setFromObject(model, true)
		const size = box.getSize(new THREE.Vector3())
		const center = box.getCenter(new THREE.Vector3())
		model.position.sub(center)
		model.position.y += size.y / 2 // stand it on the ground at y = 0
		bounds = new THREE.Box3().setFromObject(model, true)
		const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius
		target = bounds.getCenter(new THREE.Vector3())
		dist =
			(radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) *
			(matchPoster ? 0.92 : 1)
		pose(elevation())
		camera.near = dist / 50
		camera.far = dist * 4
		camera.updateProjectionMatrix()
		uniforms.uNear.value = camera.near
		uniforms.uFar.value = camera.far
		controls.target.copy(target)
		controls.update()

		const u = (ground.material as THREE.ShaderMaterial).uniforms
		ground.visible = false // the bakes must not see the previous model's shadow
		const extent = Math.max(size.x, size.z) * SHADOW.planeScale
		ground.scale.set(extent, extent, 1)
		ground.position.set(target.x, 0.001, target.z)
		model.traverse((o) => {
			if ((o as THREE.Mesh).isMesh) o.castShadow = true
		})
		const contactExtent = Math.max(size.x, size.z) * SHADOW.contactScale
		// Whole render targets, not their textures: a texture's dispose leaves the framebuffer and depth buffer behind.
		contactTarget?.dispose()
		contactTarget = bakeContact(
			target,
			contactExtent,
			size.y * SHADOW.contactReach
		)
		u.uContact.value = contactTarget.texture
		u.uContactScale.value = extent / contactExtent
		bakeTarget?.dispose()
		bakeTarget = null
		loadedShadow?.dispose()
		loadedShadow = bakedShadow
		if (bakedShadow) u.uBake.value = bakedShadow
		else {
			const acc = bakeDirectional(target, extent, radius)
			bakeTarget = acc
			u.uBake.value = acc.texture
			lastBake = () => densityPng(acc)
		}
		u.uHasBake.value = 1
		model.traverse((o) => {
			if ((o as THREE.Mesh).isMesh) o.castShadow = false
		})
	}
	let lastBake: (() => string) | null = null
	let contactTarget: THREE.WebGLRenderTarget | null = null
	let bakeTarget: THREE.WebGLRenderTarget | null = null
	let loadedShadow: THREE.Texture | null = null

	/* The file's longer side faces the sheet in the drawing; the turn to three-quarter happens once it is an object. */
	let side = 0
	const elevation = () => ({ az: side + ELEVATION.az, el: ELEVATION.el })
	const object = () => ({ az: side + OBJECT.az, el: OBJECT.el })

	let running: { cancel: () => void } | null = null
	function animate(
		duration: number,
		apply: (k: number) => void,
		then: () => void = () => {}
	) {
		const t0 = performance.now()
		let live = true
		const step = (t: number) => {
			if (!live) return
			const k = Math.min((t - t0) / duration, 1)
			apply(k)
			frame()
			if (k < 1) requestAnimationFrame(step)
			else then()
		}
		requestAnimationFrame(step)
		running = { cancel: () => (live = false) }
		return running
	}

	/* The frame's box out of the canvas, as a PNG data URL: what the bakes save. */
	function cropToFrame() {
		const canvas = el.canvas.getBoundingClientRect()
		const box = el.frame.getBoundingClientRect()
		const k = el.canvas.width / canvas.width
		const crop = document.createElement('canvas')
		crop.width = Math.round(box.width * k)
		crop.height = Math.round(box.height * k)
		crop
			.getContext('2d')!
			.drawImage(
				el.canvas,
				(box.left - canvas.left) * k,
				(box.top - canvas.top) * k,
				crop.width,
				crop.height,
				0,
				0,
				crop.width,
				crop.height
			)
		return crop.toDataURL('image/png')
	}

	const listeners: { frame?: () => void } = {}
	const loader = new GLTFLoader()
	const draco = new DRACOLoader()
	draco.setDecoderPath('/draco/')
	loader.setDRACOLoader(draco)

	const themeObserver = new MutationObserver(readTheme)
	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['class']
	})
	readTheme()
	const resizeObserver = new ResizeObserver(resize)
	resizeObserver.observe(el.stage)

	return {
		/** Draws a GLB as its front elevation, framed on its poster when it has one. Its shadow is baked unless one is given. */
		async show(
			buffer: ArrayBuffer,
			{
				bakedShadow = null,
				poster = false
			}: { bakedShadow?: THREE.Texture | null; poster?: boolean } = {}
		) {
			// Parsed first: a file that will not parse must leave the model on stage, and its framing, as they were.
			const gltf = await loader.parseAsync(buffer, '')
			// Torn down while it parsed: placing it now would build render targets on a renderer that is gone.
			if (disposed) {
				release(gltf.scene)
				bakedShadow?.dispose()
				return
			}
			running?.cancel()
			matchPoster = poster
			const size = new THREE.Box3()
				.setFromObject(gltf.scene, true)
				.getSize(new THREE.Vector3())
			side = size.x >= size.z ? 0 : Math.PI / 2
			turned = false
			uniforms.uReveal.value = 0
			controls.enabled = false
			el.dims?.removeAttribute('data-gone')
			el.scale?.removeAttribute('data-gone')
			place(gltf.scene, bakedShadow)
			resize()
			frame()
			drawDims()
		},
		/** The slow scan from drawing to object, then the turn; resolves when the object is the reader's. */
		reveal(): Promise<void> {
			return new Promise((resolve) => {
				const u = uniforms.uReveal
				const turn = () => {
					turned = true
					el.dims?.setAttribute('data-gone', '')
					el.scale?.setAttribute('data-gone', '')
					// Yours the moment it is an object: the turn runs, but a grab takes over from it.
					controls.target.copy(target)
					controls.update()
					controls.enabled = true
					resolve()
					if (reducedMotion) {
						pose(object())
						controls.update()
						frame()
						return
					}
					const a = elevation()
					const b = object()
					const run = animate(TIMING.turn, (k) => {
						const e = 1 - Math.pow(1 - k, 3)
						pose({ az: a.az + (b.az - a.az) * e, el: a.el + (b.el - a.el) * e })
					})
					const takeOver = () => {
						run.cancel()
						controls.removeEventListener('start', takeOver)
					}
					controls.addEventListener('start', takeOver)
				}
				if (reducedMotion) {
					u.value = 1.02
					turn()
					return
				}
				// A slow, even scan: in-out, so it neither lurches off nor stalls at the top.
				animate(
					TIMING.sweep,
					(k) => (u.value = (0.5 - Math.cos(Math.PI * k) / 2) * 1.02),
					turn
				)
			})
		},
		/** Refits the camera to the frame box where it is now: for a frame that moves while the stage keeps its size. */
		fit() {
			fitCamera()
			request()
		},
		/** The camera's azimuth from the drawing's face, for the backdrop's light to follow. */
		azimuth: () => (turned ? controls.getAzimuthalAngle() - side : 0),
		onFrame(listener: () => void) {
			listeners.frame = listener
		},
		/** Bake mode only: the directional shadow just baked, as a PNG data URL. */
		bakedShadowPng: () => lastBake?.() ?? null,
		/** Bake mode only: the drawing inside the frame, as a PNG data URL whose alpha is the line coverage. */
		posterPng() {
			frame()
			return cropToFrame()
		},
		/** Bake mode only: the rendered object in the drawing's exact framing, so the two can be laid over each other. */
		objectPng() {
			const reveal = uniforms.uReveal.value
			uniforms.uReveal.value = 1.02 // past the sweep: nothing inked, nothing erased
			bakingObject = true
			frame()
			bakingObject = false
			uniforms.uReveal.value = reveal
			return cropToFrame()
		},
		dispose() {
			disposed = true
			running?.cancel()
			cancelAnimationFrame(raf)
			themeObserver.disconnect()
			resizeObserver.disconnect()
			controls.dispose()
			draco.dispose()
			rtN?.dispose()
			contactTarget?.dispose()
			bakeTarget?.dispose()
			loadedShadow?.dispose()
			renderer.dispose()
		}
	}
}

export type StageEngine = ReturnType<typeof createStageEngine>
