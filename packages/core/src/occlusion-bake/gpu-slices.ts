/*
  A bake draw over the whole target can keep the GPU busy for seconds, and the
  page cannot composite a frame until the queue drains. So the bake is drawn
  in slices sized to a few milliseconds, and each slice waits until the GPU
  has finished the last: at most one bounded piece of bake work is ever queued
  ahead of the page's frames.

  A slice is cut by rays before texels. The GPU shades its own screen tiles in
  parallel and a draw lasts as long as its densest one, so a small scissored
  region leaves most of the GPU idle: the whole target with fewer rays per
  texel does the same work several times faster. Only when one ray over the
  whole target is already too much is it split into scissored tiles.
*/

/** A scissor rectangle in target pixels, origin at the bottom left. */
export interface Tile {
	x: number
	y: number
	width: number
	height: number
}

/** One draw: rays `firstSample` up to `firstSample + samples` over `tile`. */
export interface Slice {
	tile: Tile
	firstSample: number
	samples: number
}

/** The most rays per texel in one draw, so no draw grows past what it was before slicing. */
export const MAX_SAMPLES_PER_DRAW = 16
/** How long one slice should keep the GPU busy, so frames slot in between. */
export const TARGET_SLICE_MS = 6
/** The first slice's budget in texel-rays: small, since nothing is measured yet. */
export const FIRST_SLICE_BUDGET = 32 * 32
/** The smallest budget: below it a draw is all overhead. */
export const MIN_SLICE_BUDGET = 16 * 16
/** A fixed budget where no fence can say when the GPU is done. */
export const UNFENCED_SLICE_BUDGET = 256 * 256
/**
 * The most a budget may grow from one slice to the next. Cost follows how much
 * of a slice the UVs cover, so a slice measured over empty space says little
 * about the next one.
 */
const MAX_GROWTH = 2

/*
  Every ray of a `size` by `size` target with `samples` rays per texel, each
  exactly once, in slices of about `budget()` texel-rays, read before every
  slice. While the budget covers the whole target, a slice is the whole target
  with as many rays as fit; below that, each ray is drawn over tiles of the
  budget's area.
*/
export function* slicesOf(
	size: number,
	samples: number,
	budget: () => number
): Generator<Slice> {
	const whole = { x: 0, y: 0, width: size, height: size }
	for (let firstSample = 0; firstSample < samples;) {
		const rays = Math.floor(budget() / (size * size))
		if (rays >= 1) {
			const count = Math.min(rays, MAX_SAMPLES_PER_DRAW, samples - firstSample)
			yield { tile: whole, firstSample, samples: count }
			firstSample += count
		} else {
			for (const tile of tilesOf(size, budget)) {
				yield { tile, firstSample, samples: 1 }
			}
			firstSample += 1
		}
	}
}

/*
  Covers a `size` by `size` target once, in bands from the bottom: each band
  is as tall as the side of a square tile of the area asked at its start, and
  each tile along it as wide as that area allows.
*/
function* tilesOf(size: number, area: () => number): Generator<Tile> {
	for (let y = 0; y < size;) {
		const height = clamp(Math.round(Math.sqrt(area())), 1, size - y)
		for (let x = 0; x < size;) {
			const width = clamp(Math.round(area() / height), 1, size - x)
			yield { x, y, width, height }
			x += width
		}
		y += height
	}
}

/**
 * The budget for the next slice: the texel-rays the GPU would get through in
 * `TARGET_SLICE_MS` at the pace it drew the last slice. A slice cut short by
 * the target's edge or its last rays is mostly overhead and says little about
 * that pace, so it leaves the budget as it was.
 */
export function nextSliceBudget(
	budget: number,
	drawn: number,
	elapsedMs: number,
	maxBudget: number
): number {
	if (drawn < budget / 2) return budget
	const paced = (drawn * TARGET_SLICE_MS) / Math.max(elapsedMs, Number.EPSILON)
	return clamp(
		Math.round(Math.min(paced, budget * MAX_GROWTH)),
		MIN_SLICE_BUDGET,
		maxBudget
	)
}

/**
 * Resolves once the GPU has run everything submitted before the fence, polling
 * without blocking and yielding a task between polls. Also resolves when the
 * wait fails, as it does on a lost context: the caller checks for that.
 */
export async function gpuSettled(
	gl: WebGL2RenderingContext,
	fence: WebGLSync
): Promise<void> {
	try {
		// The first poll flushes, or a fence still in the command buffer never signals.
		let flags: number = gl.SYNC_FLUSH_COMMANDS_BIT
		while (gl.clientWaitSync(fence, flags, 0) === gl.TIMEOUT_EXPIRED) {
			flags = 0
			await yieldTask()
		}
	} finally {
		gl.deleteSync(fence)
	}
}

/** The slice-timing half of `EXT_disjoint_timer_query_webgl2`. */
export interface GpuTimer {
	TIME_ELAPSED_EXT: number
	GPU_DISJOINT_EXT: number
}

/**
 * How long the GPU spent between a timer query's begin and end, in
 * milliseconds, and deletes the query. Undefined while the result is not in
 * yet, or when the GPU's clock jumped during it: the caller falls back to
 * the wall clock, which counts the page's frames too and so only ever
 * overstates a slice.
 */
export function gpuTimeMs(
	gl: WebGL2RenderingContext,
	timer: GpuTimer,
	query: WebGLQuery
): number | undefined {
	try {
		const ready = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)
		const disjoint = gl.getParameter(timer.GPU_DISJOINT_EXT)
		if (!ready || disjoint) return undefined
		return gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6
	} finally {
		gl.deleteQuery(query)
	}
}

/*
  A task boundary without the 4 ms floor browsers put on nested timeouts: the
  fence's status only changes between tasks, and a floored wait would leave
  the GPU idle longer than a slice takes.
*/
function yieldTask(): Promise<void> {
	return new Promise((resolve) => {
		const channel = new MessageChannel()
		channel.port1.onmessage = () => {
			channel.port1.close()
			resolve()
		}
		channel.port2.postMessage(undefined)
	})
}

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value))
