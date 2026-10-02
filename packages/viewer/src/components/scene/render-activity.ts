import type { Camera, Object3D } from 'three'

/**
 * Decides, once per frame, whether the viewer is in motion or at rest, and what
 * an at-rest frame should render.
 *
 * In motion every frame is drawn normally. At rest the viewer draws a fixed
 * number of frames with the projection nudged by a sub-pixel each time and
 * averages them, which converges edges to supersampled quality and lets
 * screen-space AO settle its noise. After the last sample nothing more needs
 * drawing until something changes, so a still scene costs no GPU time.
 *
 * Pure apart from reading the scene graph, so every input that can restart the
 * accumulation is testable without a WebGL context.
 */

/** Samples averaged before the frame counts as converged. */
export const ACCUMULATION_SAMPLES = 32

/**
 * Tolerance for "the camera did not move". OrbitControls' damping tail creeps
 * toward rest in ever smaller steps; anything below this is invisible at any
 * realistic canvas size and would otherwise hold the viewer in motion.
 */
const MATRIX_EPSILON = 1e-6

const halton = (index: number, base: number): number => {
	let result = 0
	let fraction = 1 / base
	let i = index
	while (i > 0) {
		result += fraction * (i % base)
		i = Math.floor(i / base)
		fraction /= base
	}
	return result
}

/**
 * Sub-pixel offsets in `[-0.5, 0.5)`, from the (2, 3) Halton sequence: evenly
 * spread at every prefix length, so a sequence cut short by motion still
 * averages to a balanced set of samples.
 */
export const JITTER_OFFSETS: ReadonlyArray<readonly [number, number]> =
	Array.from(
		{ length: ACCUMULATION_SAMPLES },
		(_, i) => [halton(i + 1, 2) - 0.5, halton(i + 1, 3) - 0.5] as const
	)

/**
 * A cheap fingerprint of everything that moves on its own: every visible
 * object's world transform, weighted by its place in the walk, so hiding an
 * object or reordering the graph changes it too. It catches what never calls `invalidate()`, such as
 * skeletal and node animation, or a consumer's `children` spinning in their own
 * `useFrame`. Expects world matrices to be current.
 */
export const computeSceneSignature = (scene: Object3D): number => {
	let signature = 0
	let index = 0
	scene.traverseVisible((object) => {
		index += 1
		const elements = object.matrixWorld.elements
		for (let i = 0; i < 16; i++) {
			// A degenerate transform elsewhere in the graph (drei's Center over
			// empty content writes NaN) must not poison the sum: NaN never equals
			// itself, and the viewer would read as moving on every frame.
			if (Number.isFinite(elements[i])) signature += elements[i] * (index + i)
		}
	})
	return signature
}

export interface ActivityInputs {
	camera: Camera
	/** Drawing-buffer width and height, in device pixels. */
	width: number
	height: number
	sceneSignature: number
	/** Someone called `invalidate()` since the previous frame. */
	invalidated: boolean
	/** A caller-held activity flag, such as animation playback. */
	active: boolean
}

export type FramePlan =
	| { kind: 'motion' }
	| { kind: 'accumulate'; sample: number; offset: readonly [number, number] }
	| { kind: 'converged' }

const matricesMatch = (a: Float32Array | number[], b: number[]): boolean => {
	for (let i = 0; i < 16; i++) {
		if (Math.abs(a[i] - b[i]) > MATRIX_EPSILON) return false
	}
	return true
}

/**
 * Tracks the previous frame's inputs and plans the next one. The first frame
 * is always motion, so a fresh viewer draws before it accumulates.
 */
export const createRenderActivity = () => {
	const lastWorld: number[] = new Array(16).fill(Number.NaN)
	const lastProjection: number[] = new Array(16).fill(Number.NaN)
	let lastWidth = -1
	let lastHeight = -1
	let lastSignature = Number.NaN
	let sample = 0

	const plan = (inputs: ActivityInputs): FramePlan => {
		const { camera } = inputs
		const moved =
			!matricesMatch(camera.matrixWorld.elements, lastWorld) ||
			!matricesMatch(camera.projectionMatrix.elements, lastProjection) ||
			inputs.width !== lastWidth ||
			inputs.height !== lastHeight ||
			inputs.sceneSignature !== lastSignature

		for (let i = 0; i < 16; i++) {
			lastWorld[i] = camera.matrixWorld.elements[i]
			lastProjection[i] = camera.projectionMatrix.elements[i]
		}
		lastWidth = inputs.width
		lastHeight = inputs.height
		lastSignature = inputs.sceneSignature

		if (moved || inputs.invalidated || inputs.active) {
			sample = 0
			return { kind: 'motion' }
		}

		if (sample < ACCUMULATION_SAMPLES) {
			const current = sample
			sample += 1
			return {
				kind: 'accumulate',
				sample: current,
				offset: JITTER_OFFSETS[current]
			}
		}

		return { kind: 'converged' }
	}

	return { plan }
}

export type RenderActivity = ReturnType<typeof createRenderActivity>
