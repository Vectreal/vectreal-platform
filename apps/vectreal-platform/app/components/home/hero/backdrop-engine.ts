import { BAYER4_GLSL, DITHER_CELL_PX } from '../../../lib/dither/dither'

/**
 * The sheet's backdrop: two blobs in one dithered field, behind the whole fold.
 *
 * Grain radiates from the left edge at the copy's height; light pools behind the
 * object. Each hovers (a slow drift of its center) and breathes (noise pushing
 * its edge in and out), and the field is their sum, so where their tails meet
 * they bridge and merge like metaballs, and part again as they drift.
 *
 * Its own small WebGL2 canvas, because the stage's canvas erases everything that
 * is not the object. It shares the stage's matrix and cell, so the dissolve at
 * the copy, the light and the grain read as one material.
 *
 * The drift is ambient motion, which the motion doctrine would not allow on its
 * own terms; the owner accepted it for this surface knowingly. It is kept to the
 * minimum that reads: 20 frames a second, only while the fold is on screen, and
 * one still frame under reduced motion.
 */

export interface BackdropElements {
	canvas: HTMLCanvasElement
	sheet: HTMLElement
	stage: HTMLElement
	frame: HTMLElement
	copy: HTMLElement
	readout: HTMLElement
}

const vertex = /* glsl */ `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`

const fragment = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes, uOrigin, uReach; uniform float uCell, uTime, uSoft; uniform vec3 uPool; uniform vec4 uLight, uGrain, uCopy;
out vec4 o;
${BAYER4_GLSL}
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
/* 0 inside a text block, rising to 1 over uSoft outside it. */
float clearOf(vec4 r, vec2 c){ vec2 d = max(r.xy - c, c - r.zw); return smoothstep(0.0, uSoft, max(d.x, d.y)); }
void main(){
  vec2 cell = floor(gl_FragCoord.xy / uCell), c = (cell + 0.5) * uCell;   // one decision per cell, like the edge
  float t = bayer4(cell);
  vec2 q = c / (uRes.y * 0.22), qs = c / (uRes.y * 0.4);
  float n = 0.5 * noise(q + vec2(uTime * 0.013, uTime * 0.006)) + 0.5 * noise(q * 1.9 - vec2(uTime * 0.008, -uTime * 0.011));
  float ea = noise(qs + vec2(uTime * 0.02, 3.1)) - 0.5, eb = noise(qs + vec2(7.3, -uTime * 0.017)) - 0.5;
  vec2 da = vec2(sin(uTime * 0.05), cos(uTime * 0.041)) * uReach * 0.04;
  vec2 db = vec2(cos(uTime * 0.037), sin(uTime * 0.047)) * uPool.z * 0.06;
  float a = 1.0 - smoothstep(0.0, 1.0, length((c - uOrigin - da) / uReach) + ea * 0.5);
  float b = 1.0 - smoothstep(0.0, 1.0, length(c - uPool.xy - db) / uPool.z + eb * 0.5);
  /* Grain is patchy inside and thinned (not cleared: a hole would outline the text block) behind the words. */
  float ga = a * (0.35 + 0.65 * smoothstep(0.3, 0.8, n)) * 0.85 * mix(0.55, 1.0, clearOf(uCopy, c));
  float gb = b * 0.95;
  if (step(t, min(ga + gb, 1.0)) < 0.5) { o = vec4(0.0); return; }
  /* Which ink a cell takes follows who owns it, dithered on a second offset of the matrix so the bridge mixes evenly. */
  o = step(bayer4(cell + vec2(2.0, 1.0)), gb / (ga + gb)) > 0.5 ? uLight : uGrain;
}`

const FOLDED = '(max-width: 1099px)'

export function createBackdropEngine(
	el: BackdropElements,
	options: { reducedMotion: boolean; azimuth: () => number }
) {
	const gl = el.canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		antialias: false
	})
	if (!gl) return null

	const shader = (type: number, source: string) => {
		const s = gl.createShader(type)!
		gl.shaderSource(s, source)
		gl.compileShader(s)
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
			throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
		return s
	}
	const program = gl.createProgram()!
	gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex))
	gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment))
	gl.linkProgram(program)
	gl.useProgram(program)
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 3, -1, -1, 3]),
		gl.STATIC_DRAW
	)
	const loc = gl.getAttribLocation(program, 'p')
	gl.enableVertexAttribArray(loc)
	gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
	const u = Object.fromEntries(
		[
			'uRes',
			'uCell',
			'uTime',
			'uSoft',
			'uPool',
			'uLight',
			'uGrain',
			'uCopy',
			'uOrigin',
			'uReach'
		].map((n) => [n, gl.getUniformLocation(program, n)])
	)

	// Token colors resolved through a 2D canvas, which understands oklch and color-mix, into premultiplied RGBA.
	const probe = document
		.createElement('canvas')
		.getContext('2d', { willReadFrequently: true })!
	probe.canvas.width = probe.canvas.height = 1
	const rgba = (css: string) => {
		probe.clearRect(0, 0, 1, 1)
		probe.fillStyle = css
		probe.fillRect(0, 0, 1, 1)
		const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
		return [r / 255, g / 255, b / 255, 1]
	}
	function readTheme() {
		const style = getComputedStyle(el.sheet)
		gl!.uniform4fv(u.uLight, rgba(style.getPropertyValue('--hero-pool')))
		gl!.uniform4fv(u.uGrain, rgba(style.getPropertyValue('--hero-grain')))
		draw()
	}

	const t0 = performance.now()
	function draw() {
		const dpr = Math.min(window.devicePixelRatio, 2)
		const r = el.canvas.getBoundingClientRect()
		const w = Math.round(r.width * dpr)
		const h = Math.round(r.height * dpr)
		if (!w || !h) return
		if (el.canvas.width !== w || el.canvas.height !== h) {
			el.canvas.width = w
			el.canvas.height = h
			gl!.viewport(0, 0, w, h)
		}
		// The light sits where the object stands: under the frame's center, low in the stage, as large as the stage allows.
		const s = el.stage.getBoundingClientRect()
		const f = el.frame.getBoundingClientRect()
		const cx = f.left + f.width / 2 - s.left
		const cy = s.height * 0.58
		const radius = Math.min(cx, s.width - cx, cy, s.height - cy)
		// The key light is fixed in the world, so as the camera orbits the lit patch slides the other way.
		const px =
			s.left - r.left + cx - Math.sin(options.azimuth()) * radius * 0.22
		const py = s.top - r.top + cy
		gl!.uniform2f(u.uRes, w, h)
		gl!.uniform1f(u.uCell, DITHER_CELL_PX * dpr)
		gl!.uniform1f(u.uTime, (performance.now() - t0) / 1000)
		gl!.uniform3f(u.uPool, px * dpr, (r.height - py) * dpr, radius * dpr)
		// Text blocks in this canvas's GL coordinates (y up), padded a little before the soft edge starts.
		const rect = (node: Element, pad: number) => {
			const b = node.getBoundingClientRect()
			return [
				(b.left - r.left - pad) * dpr,
				(r.bottom - b.bottom - pad) * dpr,
				(b.right - r.left + pad) * dpr,
				(r.bottom - b.top + pad) * dpr
			]
		}
		const copy = rect(el.copy, 16)
		const read = rect(el.readout, 0)
		gl!.uniform4fv(u.uCopy, copy)
		gl!.uniform1f(u.uSoft, 96 * dpr)
		// Origin on the left edge, level with the copy's center; it reaches past the copy and stops short of the readout.
		const oy = (copy[1] + copy[3]) / 2
		gl!.uniform2f(u.uOrigin, 0, oy)
		// Folded, the readout sits a screen below the copy, so there the grain is sized by the copy instead.
		if (matchMedia(FOLDED).matches)
			gl!.uniform2f(u.uReach, w * 0.6, (copy[3] - copy[1]) * 0.45)
		else gl!.uniform2f(u.uReach, copy[2] + 200 * dpr, oy - read[3] - 16 * dpr)
		gl!.clearColor(0, 0, 0, 0)
		gl!.clear(gl!.COLOR_BUFFER_BIT)
		gl!.drawArrays(gl!.TRIANGLES, 0, 3)
	}

	let visible = true
	let raf = 0
	let last = 0
	const tick = (t: number) => {
		raf = 0
		if (!visible) return
		if (t - last > 50) {
			last = t
			draw()
		}
		raf = requestAnimationFrame(tick)
	}
	const intersection = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting
		if (visible && !options.reducedMotion && !raf)
			raf = requestAnimationFrame(tick)
	})
	intersection.observe(el.canvas)
	const resize = new ResizeObserver(() => draw())
	resize.observe(el.sheet)
	const theme = new MutationObserver(readTheme)
	theme.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['class']
	})
	readTheme()

	return {
		draw,
		dispose() {
			cancelAnimationFrame(raf)
			intersection.disconnect()
			resize.disconnect()
			theme.disconnect()
			// The context is left alive: a remount (StrictMode mounts twice) draws on the same canvas.
		}
	}
}
