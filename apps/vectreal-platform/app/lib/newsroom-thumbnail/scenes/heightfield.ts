import { makeNoise2d, makePrng } from '../prng'
import {
	clipNear,
	fogOpacity,
	projectCameraSpace,
	sortByDepth,
	toCameraSpace
} from '../projection'

import type {
	Camera,
	DepthSegment,
	Fog,
	Segment,
	Vec3,
	Viewport
} from '../projection'

export interface GridSize {
	nx: number
	nz: number
}

export interface HeightfieldOptions {
	viewport: Viewport
	grid?: GridSize
}

/**
 * The one shipped density. Roughly 17k segments; the value the scene was tuned
 * at, and what every baked .webp uses - card, hero and og alike.
 *
 * An earlier revision rendered the hero as inline SVG at a much lower density
 * to fit a byte budget. Measured at full density that SVG was 76KB gzipped
 * against ~65KB for the equivalent WebP, so the inline path cost more bytes,
 * shipped the scene core to the browser, and looked worse. It is gone.
 */
export const BAKED_GRID: GridSize = { nx: 90, nz: 96 }

/**
 * Lower density for the dev-only contact sheet, which renders ten scenes at
 * once in the browser while shuffling seeds. Composition reads the same; only
 * the line count differs. Never used for shipped output.
 */
export const PREVIEW_GRID: GridSize = { nx: 60, nz: 64 }

const STEP = 0.62
const ORIGIN_Z = -5.0
const ACCENT_HEIGHT = 0.85
const STROKE_WIDTH = 0.55

const FOG: Fog = { near: 4, far: 62, power: 0.85 }

/**
 * Near at 3.5 combined with the grid origin at z = -5.0 is load-bearing:
 * closer values let rows straddle the near plane and project into long streak
 * artifacts across the frame.
 */
const BASE_CAMERA: Omit<Camera, 'yaw'> = {
	position: { x: 0, y: 3.4, z: 2.0 },
	pitch: 0.2,
	fov: 54,
	near: 3.5
}

const MIN_OPACITY = 0.012

/**
 * A noise-warped quad mesh filling the lower two thirds of the frame, seen
 * from a camera tilted down so the horizon sits around 35% from the top.
 * Accent applies above a height threshold, which reads as a contour highlight.
 */
export function heightfield(
	seed: number,
	options: HeightfieldOptions
): Segment[] {
	const grid = options.grid ?? BAKED_GRID
	const { viewport } = options
	const rand = makePrng(seed)
	const noise = makeNoise2d(seed)

	const camera: Camera = { ...BASE_CAMERA, yaw: (rand() - 0.5) * 0.4 }

	const count = grid.nx * grid.nz
	const heights = new Float64Array(count)
	const cameraSpace: Vec3[] = new Array(count)

	// Every grid maps onto the SAME terrain: positions and noise are sampled in
	// BAKED_GRID index space, so a lower-density grid subsamples the identical
	// landscape rather than generating a smaller one. Without this, dropping the
	// hero density also shrinks the mesh's world extent and the composition
	// collapses into a small island floating mid-frame instead of filling the
	// lower two thirds.
	const scaleX = BAKED_GRID.nx / grid.nx
	const scaleZ = BAKED_GRID.nz / grid.nz

	for (let j = 0; j < grid.nz; j++) {
		for (let i = 0; i < grid.nx; i++) {
			const index = j * grid.nx + i
			const refI = i * scaleX
			const refJ = j * scaleZ
			const n =
				noise(refI * 0.1, refJ * 0.1) + 0.45 * noise(refI * 0.26, refJ * 0.26)
			const height = (n - 0.72) * 3.0

			heights[index] = height
			cameraSpace[index] = toCameraSpace(
				{
					x: (refI - BAKED_GRID.nx / 2) * STEP,
					y: height,
					z: ORIGIN_Z - refJ * STEP
				},
				camera
			)
		}
	}

	const segments: DepthSegment[] = []

	const push = (from: number, to: number) => {
		const clipped = clipNear(cameraSpace[from], cameraSpace[to], camera.near)

		if (!clipped) {
			return
		}

		const start = projectCameraSpace(clipped[0], camera, viewport)
		const end = projectCameraSpace(clipped[1], camera, viewport)
		const depth = (start.depth + end.depth) / 2
		const opacity = fogOpacity(depth, FOG)

		if (opacity < MIN_OPACITY) {
			return
		}

		segments.push({
			x1: start.x,
			y1: start.y,
			x2: end.x,
			y2: end.y,
			opacity,
			width: STROKE_WIDTH,
			accent: heights[from] > ACCENT_HEIGHT && heights[to] > ACCENT_HEIGHT,
			depth
		})
	}

	for (let j = 0; j < grid.nz; j++) {
		for (let i = 0; i < grid.nx; i++) {
			const index = j * grid.nx + i

			if (i < grid.nx - 1) {
				push(index, index + 1)
			}

			if (j < grid.nz - 1) {
				push(index, index + grid.nx)
			}
		}
	}

	return sortByDepth(segments).map(({ depth: _depth, ...segment }) => segment)
}
