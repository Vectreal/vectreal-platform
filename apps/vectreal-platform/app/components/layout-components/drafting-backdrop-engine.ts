import { createCssColorProbe, observeTheme } from '../../lib/theme/theme-probe'

/**
 * The site's backdrop: a drafting floor, drawn live on a 2D canvas.
 *
 * Every line runs straight to one vanishing point; a low swell travels toward
 * the viewer, and the brand shows only where a swell crests or a light stands
 * on the floor. The floor answers the reader like something heavy, a second
 * behind them: it rises softly under the pointer, a press sends a ripple
 * across it, and scrolling carries the floor toward the viewer.
 *
 * The motion is the exception to the motion doctrine the owner made for these
 * surfaces. It is kept to what reads: the display rate only while something is
 * settling, 20 frames a second (simulation included) while only the swell
 * drifts, nothing while the canvas is off screen, and under reduced motion one
 * still frame and no listeners at all. A `calm` floor, for a work surface,
 * only drifts: no pointer, no ripples, no scroll.
 *
 * Kept out of every route's first load: callers import this module
 * dynamically, so only the canvas element is in the server's HTML.
 */

export interface DraftingView {
	/** Where the horizon sits, as a fraction of the canvas height from the top. */
	horizon: number
	/** Where the lines meet, as a fraction of the canvas width from the left. */
	focusX: number
}

export interface DraftingBackdropOptions {
	reducedMotion: boolean
	/** The element the reader points at. The canvas sits behind content and takes no pointer itself. */
	host: HTMLElement
	/** Read every frame, so a layout change moves the floor with it. */
	view: (canvas: DOMRect) => DraftingView
	/**
	  A work surface's floor: a lower, slower swell in fainter lines, no brand
	  on its crests, and nothing that answers the pointer or the scroll. It
	  drifts and nothing else, so it never competes with the task in front of it.
	*/
	calm?: boolean
}

/* The floor, in grid steps. The tight net: 104 by 92 lines a little under half a step apart. */
const NX = 104
const NZ = 92
const N = NX * NZ
const STEP = 0.46
const ORIGIN_Z = -4
const CAMERA_HEIGHT = 3
const FOCAL = 1 / Math.tan((50 * Math.PI) / 360)
/** Load-bearing with ORIGIN_Z: any closer and the near rows streak. */
const NEAR = 3.5
const FOG = { near: 6, far: 44, power: 1.1 }
const SWELL = 0.9
/** The height at which a swell takes the brand, faded in across a band so a crest never flickers. */
const CREST = 0.45
/** The most brand a crest takes: across a whole scrolling page, crests in full brand swept orange bands through every section. */
const CREST_BRAND = 0.4
const SEED = 0x5eed
/** What `calm` scales: the swell's height, its drift, the brand on its crests and the ink. */
const LIVELY = { swell: 1, drift: 1, brand: 1, ink: 1 }
const CALM = { swell: 0.55, drift: 0.5, brand: 0, ink: 0.7 }

/* Tuning: amplitudes in grid steps, time constants in seconds. */
const DRIFT = 0.03
const FIELD_RISE = 0.18
const FIELD_RADIUS_SQ = 10.2
const FIELD_TAU = 1.1
const GLOW_TAU = 1.4
const WAKE_GAIN = 0.0009
const WAKE_MAX = 0.05
const PULSE_AMP = 0.22
const RIPPLE_DAMP = 0.988
const RIPPLE_HZ = 60
const SCROLL_RISE = 0.07
/** How far the swell advances while its section scrolls away, in noise units. */
const SCROLL_ADVANCE = 0.9
const SCROLL_TAU = 0.35
const FLOW_GAIN = 0.0006
const FLOW_MAX = 0.3
const FLOW_TAU = 0.5

/* Ink. */
const LINE_WIDTH = 0.5
const LINE_ALPHA = { light: 0.26, dark: 0.34 }
const ACCENT_ALPHA = 0.85
/** A light on the floor, kept low: at full strength it read as sweetened. */
const LIGHT_STRENGTH = { light: 0.3, dark: 0.42 }
/** One path per opacity step and ink, so a frame is 48 strokes however many lines it has. */
const BUCKETS = 24
/** How far past kept-clear text the lines take to come back, and what is left of them behind it. */
const CLEAR_SOFT_PX = 120
const CLEAR_FLOOR = 0.12

const IDLE_FRAME_MS = 50
/** How long after the reader last did something the floor still runs at the display rate. */
const SETTLE_MS = 1500
/** Below this rate, in grid steps a second, the pointer's rise counts as settled, even with the pointer resting on it. */
const SETTLED_RATE = 2e-3

const smoothstep = (a: number, b: number, x: number) => {
	const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
	return t * t * (3 - 2 * t)
}
const ease = (tau: number, dt: number) => 1 - Math.exp(-dt / tau)
const wx = (i: number) => (i - (NX - 1) / 2) * STEP
const wz = (j: number) => ORIGIN_Z - j * STEP

/* Value noise on an integer-hashed lattice, the newsroom thumbnails' noise, so the floor reads the same baked or live. */
function hashLattice(x: number, y: number) {
	let h = SEED ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1)
	h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
	h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
	h ^= h >>> 15
	return (h >>> 0) / 4294967296
}
function noise(x: number, y: number) {
	const xi = Math.floor(x)
	const yi = Math.floor(y)
	const fx = x - xi
	const fy = y - yi
	const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
	const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
	const a = hashLattice(xi, yi)
	const b = hashLattice(xi + 1, yi)
	const c = hashLattice(xi, yi + 1)
	const d = hashLattice(xi + 1, yi + 1)
	return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
/** The swell's height at a ground point, for a given drift. */
const swell = (x: number, z: number, drift: number) =>
	(0.7 * noise(x * 0.09 + 11, z * 0.09 - drift) +
		0.3 * noise(x * 0.21 - 4, z * 0.21 - drift * 1.6) -
		0.5) *
	2 *
	SWELL

/** Distance from a point to a box, 0 inside it. */
const distanceToBox = (
	x: number,
	y: number,
	[l, t, r, b]: readonly [number, number, number, number]
) => Math.hypot(Math.max(l - x, 0, x - r), Math.max(t - y, 0, y - b))

export function createDraftingBackdrop(
	canvas: HTMLCanvasElement,
	options: DraftingBackdropOptions
) {
	const context = canvas.getContext('2d')
	if (!context) return null
	const { host, reducedMotion } = options
	const mood = options.calm ? CALM : LIVELY
	const listens = !reducedMotion && !options.calm

	const base = new Float32Array(N)
	const field = new Float32Array(N)
	const glow = new Float32Array(N)
	let ripple = new Float32Array(N)
	let rippleLast = new Float32Array(N)
	const projected = new Float32Array(N * 3)

	let box = canvas.getBoundingClientRect()
	let width = 0
	let height = 0
	const measure = () => {
		box = canvas.getBoundingClientRect()
		width = box.width
		height = box.height
		return width > 0 && height > 0
	}

	/* ---- the camera: at (0, CAMERA_HEIGHT, 0), looking down -z, pitched so the horizon lands where the view asks ---- */
	let pitch = 0
	let shift = 0
	function aim() {
		const view = options.view(box)
		const horizon = view.horizon - SCROLL_RISE * Math.min(scrollProgress, 1)
		pitch = Math.atan(((0.5 - horizon) * 2) / FOCAL)
		shift = (view.focusX - 0.5) * width
	}
	function project(x: number, y: number, z: number, out: number) {
		const dy = y - CAMERA_HEIGHT
		const cp = Math.cos(pitch)
		const sp = Math.sin(pitch)
		const cy = dy * cp - z * sp
		const depth = -(dy * sp + z * cp)
		projected[out] =
			width / 2 + (FOCAL / (width / height)) * (x / depth) * (width / 2) + shift
		projected[out + 1] = height / 2 - FOCAL * (cy / depth) * (height / 2)
		projected[out + 2] = depth
	}
	/**
	  The floor point under a canvas point: the view ray meets the plane at the
	  swell's height there, refined twice, so the rise lands under the pointer
	  on a crest as well as in a trough.
	*/
	function unproject(sx: number, sy: number, drift: number) {
		const nx =
			(((sx - shift - width / 2) / (width / 2)) * (width / height)) / FOCAL
		const ny = (height / 2 - sy) / (height / 2) / FOCAL
		const cp = Math.cos(pitch)
		const sp = Math.sin(pitch)
		const ry = ny * cp - sp
		const rz = -ny * sp - cp
		if (ry >= -1e-4) return null
		let y = 0
		let point: [number, number] = [0, 0]
		for (let pass = 0; pass < 3; pass++) {
			const t = (y - CAMERA_HEIGHT) / ry
			point = [nx * t, rz * t]
			y = swell(point[0], point[1], drift) * mood.swell
		}
		return point
	}

	/* ---- input ---- */
	const pointer = {
		clientX: 0,
		clientY: 0,
		inside: false,
		travel: 0,
		/** The floor point under the pointer, found when the pointer, the page or the camera moves rather than every step, so a resting pointer settles. */
		ground: null as [number, number] | null,
		/** The camera it was found for: a pitch or a size that has moved since leaves it off the cursor. */
		aimedFor: ''
	}
	function aimPointer() {
		pointer.ground = null
		if (!pointer.inside || !measure()) return
		aim()
		pointer.ground = unproject(
			pointer.clientX - box.left,
			pointer.clientY - box.top,
			drift()
		)
		pointer.aimedFor = cameraKey()
	}
	const cameraKey = () => `${pitch.toFixed(5)} ${width} ${height}`
	let lastActive = -Infinity
	let scrollVelocity = 0
	let lastScroll = window.scrollY
	let lastScrollAt = performance.now()

	const onPointerMove = (event: PointerEvent) => {
		if (pointer.inside)
			pointer.travel += Math.hypot(
				event.clientX - pointer.clientX,
				event.clientY - pointer.clientY
			)
		pointer.clientX = event.clientX
		pointer.clientY = event.clientY
		// A finger only leans on the floor while it is down.
		pointer.inside = event.pointerType !== 'touch' || event.pressure > 0
		aimPointer()
		lastActive = performance.now()
		wake()
	}
	const onPointerLeave = () => {
		pointer.inside = false
		pointer.ground = null
	}
	const onPointerUp = (event: PointerEvent) => {
		if (event.pointerType !== 'touch') return
		pointer.inside = false
		pointer.ground = null
	}
	const onPointerDown = (event: PointerEvent) => {
		// A press on a control belongs to the control.
		if (
			event.target instanceof Element &&
			event.target.closest('a, button, input, select, textarea, label, canvas')
		)
			return
		if (!measure()) return
		aim()
		const ground = unproject(
			event.clientX - box.left,
			event.clientY - box.top,
			drift()
		)
		if (!ground) return
		pulse(ground[0], ground[1], PULSE_AMP, 1.4)
		lastActive = performance.now()
		wake()
	}
	// Scrolling speeds the swell toward the viewer; the speed is eased both ways, so it glides up and glides back.
	const onScroll = () => {
		const now = performance.now()
		const dt = Math.max(now - lastScrollAt, 8) / 1000
		scrollVelocity = Math.abs(window.scrollY - lastScroll) / dt
		lastScroll = window.scrollY
		lastScrollAt = now
		lastActive = now
		// A wheel scroll under a still mouse moves the page past it, so the rise moves with the page.
		aimPointer()
		wake()
	}
	function pulse(gx: number, gz: number, amplitude: number, radius: number) {
		const reach = radius * 2.5
		for (let j = 1; j < NZ - 1; j++) {
			for (let i = 1; i < NX - 1; i++) {
				const d = Math.hypot(wx(i) - gx, wz(j) - gz)
				if (d < reach)
					ripple[j * NX + i] +=
						amplitude * Math.exp(-(d * d) / (radius * radius))
			}
		}
	}

	/* ---- simulation ---- */
	let phase = 0
	let flowSpeed = 0
	let scrollProgress = 0
	let wakeLevel = 0
	let rippleClock = 0
	let rippleEnergy = 0
	let fieldRate = 0

	/** How far the section has scrolled away, 0 to 1: the floor lifts its horizon as it goes. A calm floor never travels. */
	const scrolled = () =>
		options.calm
			? 0
			: Math.min(Math.max(-box.top / Math.max(box.height, 1), 0), 1)
	const drift = () => phase + scrollProgress * SCROLL_ADVANCE

	function step(dt: number) {
		// The scroll reading fades within a fifth of a second of the last event, so a stopped page lets the flow glide down.
		scrollVelocity *= Math.exp(-dt / 0.12)
		flowSpeed +=
			(Math.min(scrollVelocity * FLOW_GAIN, FLOW_MAX) - flowSpeed) *
			ease(FLOW_TAU, dt)
		phase += (DRIFT * mood.drift + flowSpeed) * dt
		// Eased, so the floor follows the page without stepping.
		scrollProgress += (scrolled() - scrollProgress) * ease(SCROLL_TAU, dt)
		aim()

		const d = drift()
		// The horizon eases on after the last scroll event, and a canvas can resize: re-aim only when the camera has moved.
		if (pointer.inside && pointer.aimedFor !== cameraKey()) aimPointer()
		const ground = pointer.ground
		const kf = ease(FIELD_TAU, dt)
		const kg = ease(GLOW_TAU, dt)
		let fieldDelta = 0
		for (let j = 0; j < NZ; j++) {
			for (let i = 0; i < NX; i++) {
				const k = j * NX + i
				const x = wx(i)
				const z = wz(j)
				base[k] = swell(x, z, d) * mood.swell
				let near = 0
				if (ground) {
					const dx = x - ground[0]
					const dz = z - ground[1]
					near = Math.exp(-(dx * dx + dz * dz) / FIELD_RADIUS_SQ)
				}
				const change = (FIELD_RISE * near - field[k]) * kf
				field[k] += change
				fieldDelta = Math.max(fieldDelta, Math.abs(change))
				glow[k] += (near - glow[k]) * kg
			}
		}
		fieldRate = dt > 0 ? fieldDelta / dt : 0

		// Ripples: a damped wave equation at a fixed rate whatever the frame rate, fed the pointer's smoothed wake.
		wakeLevel +=
			(Math.min(pointer.travel * WAKE_GAIN, WAKE_MAX) - wakeLevel) *
			ease(0.15, dt)
		pointer.travel = 0
		rippleClock += dt
		while (rippleClock >= 1 / RIPPLE_HZ) {
			rippleClock -= 1 / RIPPLE_HZ
			if (ground && wakeLevel > 0.002)
				pulse(ground[0], ground[1], wakeLevel / 6, 0.9)
			let energy = 0
			for (let j = 1; j < NZ - 1; j++) {
				for (let i = 1; i < NX - 1; i++) {
					const k = j * NX + i
					const v =
						((ripple[k - 1] + ripple[k + 1] + ripple[k - NX] + ripple[k + NX]) *
							0.5 -
							rippleLast[k]) *
						RIPPLE_DAMP
					rippleLast[k] = v
					energy += v * v
				}
			}
			const swap = ripple
			ripple = rippleLast
			rippleLast = swap
			rippleEnergy = energy
		}
	}

	/** Whether the floor is still moving because of the reader, and so earns the display rate. */
	const settling = () =>
		performance.now() - lastActive < SETTLE_MS ||
		fieldRate > SETTLED_RATE ||
		rippleEnergy > 1e-5 ||
		flowSpeed > 0.004 ||
		Math.abs(scrolled() - scrollProgress) > 1e-3

	/* ---- ink ---- */
	const resolveColor = createCssColorProbe()
	const ink = { line: '', accent: '', lineAlpha: 0, light: 0 }
	function readTheme() {
		const style = getComputedStyle(canvas)
		const rgb = (token: string) =>
			resolveColor(style.getPropertyValue(token))
				.map((channel) => Math.round(channel * 255))
				.join(' ')
		// Light ink means a dark ground. Read from the canvas, not the document's theme, so a floor in a band set in the opposite scheme takes that scheme's strengths.
		const [r, g, b] = resolveColor(style.getPropertyValue('--foreground'))
		const dark = 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5
		ink.line = rgb('--foreground')
		ink.accent = rgb('--orange')
		ink.lineAlpha = (dark ? LINE_ALPHA.dark : LINE_ALPHA.light) * mood.ink
		ink.light = dark ? LIGHT_STRENGTH.dark : LIGHT_STRENGTH.light
		render()
	}

	/*
	  The elements the floor reads, found once and again only when the host's
	  content changes, so a frame measures them rather than searching the page.
	  Text inside an element that already keeps clear is left to it, and text
	  on a ladder surface is skipped: the surface hides the floor anyway.
	*/
	const CLEAR = 'h1, h2, p, [data-keep-clear]'
	const LIGHT = '[data-floor-light]'
	const found = new Map<string, Element[]>()
	const nodesOf = (selector: string) => {
		let nodes = found.get(selector)
		if (!nodes) {
			nodes = [...host.querySelectorAll(selector)]
			if (selector === CLEAR)
				nodes = nodes.filter(
					(node) =>
						!node.parentElement?.closest(CLEAR) &&
						!node.closest('[class*="ds-"]')
				)
			found.set(selector, nodes)
		}
		return nodes
	}
	const content = new MutationObserver(() => found.clear())
	content.observe(host, { childList: true, subtree: true })

	/** Boxes of the elements that are in view, relative to the canvas. */
	const boxesOf = (selector: string) => {
		const boxes: [number, number, number, number][] = []
		for (const node of nodesOf(selector)) {
			const r = node.getBoundingClientRect()
			if (r.bottom < box.top || r.top > box.bottom || !r.width) continue
			boxes.push([
				r.left - box.left,
				r.top - box.top,
				r.right - box.left,
				r.bottom - box.top
			])
		}
		return boxes
	}

	/* ---- render ---- */
	function render() {
		if (!measure()) return
		const dpr = Math.min(window.devicePixelRatio, 2)
		const w = Math.round(width * dpr)
		const h = Math.round(height * dpr)
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w
			canvas.height = h
		}
		aim()

		// Headings and paragraphs keep clear of the lines on their own; anything else that is read, by marking.
		const clears = boxesOf(CLEAR)
		// The nearest text decides, so text beside text never thins the lines twice.
		const clearance = (x: number, y: number) => {
			let nearest = Infinity
			for (const c of clears)
				nearest = Math.min(nearest, distanceToBox(x, y, c))
			return (
				CLEAR_FLOOR + (1 - CLEAR_FLOOR) * smoothstep(0, CLEAR_SOFT_PX, nearest)
			)
		}
		// A light stands where an object stands: across the bottom of its box, as wide as the object.
		const lights = boxesOf(LIGHT).map(([l, t, r, b]) => ({
			x: (l + r) / 2,
			y: b - (b - t) * 0.15,
			rx: (r - l) * 0.6,
			ry: (b - t) * 0.22
		}))

		for (let k = 0; k < N; k++)
			project(
				wx(k % NX),
				base[k] + field[k] + ripple[k],
				wz((k / NX) | 0),
				k * 3
			)

		const paths = Array.from({ length: BUCKETS * 2 }, () => new Path2D())
		const put = (accent: boolean, opacity: number, a: number, b: number) => {
			const level = Math.round(Math.min(opacity, 1) * (BUCKETS - 1))
			if (!(level > 0)) return
			const path = paths[(accent ? BUCKETS : 0) + level]
			path.moveTo(projected[a * 3], projected[a * 3 + 1])
			path.lineTo(projected[b * 3], projected[b * 3 + 1])
		}
		const segment = (a: number, b: number) => {
			const da = projected[a * 3 + 2]
			const db = projected[b * 3 + 2]
			if (da < NEAR || db < NEAR) return
			const fog = ((da + db) / 2 - FOG.near) / (FOG.far - FOG.near)
			let opacity = fog <= 0 ? 1 : fog >= 1 ? 0 : Math.pow(1 - fog, FOG.power)
			const mx = (projected[a * 3] + projected[b * 3]) / 2
			const my = (projected[a * 3 + 1] + projected[b * 3 + 1]) / 2
			opacity *= clearance(mx, my)
			let lit = 0
			for (const light of lights) {
				const dx = (mx - light.x) / light.rx
				const dy = (my - light.y) / light.ry
				lit += ink.light * Math.exp(-(dx * dx + dy * dy) * 1.6)
			}
			const lift =
				(base[a] + field[a] + ripple[a] + base[b] + field[b] + ripple[b]) / 2
			// Near the pointer the band lowers, so the swell it raises takes the brand first. With a light in view, the brand is the light's.
			const crest = lights.length
				? 0
				: smoothstep(
						CREST - 0.12,
						CREST + 0.12,
						lift + ((glow[a] + glow[b]) / 2) * 0.22
					)
			const brand = Math.max(
				crest * CREST_BRAND * mood.brand,
				0.75 * smoothstep(0.15, 0.9, lit)
			)
			opacity *= 1 + 0.5 * lit
			put(false, opacity * (1 - brand), a, b)
			put(true, opacity * brand, a, b)
		}
		// Far rows first, so nearer lines draw over the ones they cross.
		for (let j = NZ - 1; j >= 0; j--) {
			for (let i = 0; i < NX; i++) {
				const k = j * NX + i
				if (i < NX - 1) segment(k, k + 1)
				if (j < NZ - 1) segment(k, k + NX)
			}
		}

		context!.setTransform(dpr, 0, 0, dpr, 0, 0)
		context!.clearRect(0, 0, width, height)
		context!.lineWidth = LINE_WIDTH
		context!.lineCap = 'round'
		paths.forEach((path, index) => {
			const level = (index % BUCKETS) / (BUCKETS - 1)
			context!.strokeStyle =
				index >= BUCKETS
					? `rgb(${ink.accent} / ${level * ACCENT_ALPHA})`
					: `rgb(${ink.line} / ${level * ink.lineAlpha})`
			context!.stroke(path)
		})
		canvas.dataset.painted = ''
	}

	/*
	  The loop: every frame while something is settling, otherwise one
	  simulation step and one frame each IDLE_FRAME_MS, so an idle floor costs
	  20 steps a second, not the display rate.
	*/
	let visible = false
	let raf = 0
	let lastStep = performance.now()
	const tick = (now: number) => {
		raf = 0
		if (!visible) return
		if (settling() || now - lastStep >= IDLE_FRAME_MS) {
			if (measure()) {
				step(Math.min((now - lastStep) / 1000, 0.1))
				render()
			}
			lastStep = now
		}
		raf = requestAnimationFrame(tick)
	}
	function wake() {
		if (visible && !reducedMotion && !raf) {
			lastStep = performance.now()
			raf = requestAnimationFrame(tick)
		}
	}

	const intersection = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting
		wake()
	})
	intersection.observe(canvas)
	const resize = new ResizeObserver(() => render())
	resize.observe(canvas)
	const stopObservingTheme = observeTheme(readTheme)
	if (listens) {
		host.addEventListener('pointermove', onPointerMove, { passive: true })
		host.addEventListener('pointerleave', onPointerLeave)
		host.addEventListener('pointerup', onPointerUp)
		host.addEventListener('pointerdown', onPointerDown)
		window.addEventListener('scroll', onScroll, { passive: true })
	}
	// The still frame: the swell at rest, nothing raised.
	measure()
	scrollProgress = scrolled()
	step(0)
	readTheme()

	return {
		dispose() {
			cancelAnimationFrame(raf)
			intersection.disconnect()
			content.disconnect()
			resize.disconnect()
			stopObservingTheme()
			host.removeEventListener('pointermove', onPointerMove)
			host.removeEventListener('pointerleave', onPointerLeave)
			host.removeEventListener('pointerup', onPointerUp)
			host.removeEventListener('pointerdown', onPointerDown)
			window.removeEventListener('scroll', onScroll)
		}
	}
}
