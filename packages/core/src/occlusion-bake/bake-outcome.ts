import type { WebGLRenderer } from 'three'

/**
 * Why a bake drew nothing, as a code. Core says what happened; the words a
 * person reads are the caller's.
 */
export type BakeFailureReason =
	/** No WebGL 2 renderer could be made: hardware acceleration off, or none. */
	| 'no-webgl'
	/** The GPU reset mid-bake on every attempt. */
	| 'gpu-reset'
	/** Anything else, which is more likely a bug than the scene. */
	| 'unexpected'

/** A failure a bake raises on purpose, with its reason. */
export class BakeError extends Error {
	constructor(
		readonly reason: BakeFailureReason,
		message: string
	) {
		super(message)
		this.name = 'BakeError'
	}
}

/** A bake that drew nothing: its reason, and the error behind it for logs. */
export interface BakeFailure {
	failed: BakeFailureReason
	detail: string
}

/**
 * How a bake got its result after the GPU reset under it: drawn again as
 * asked, or drawn at lower detail. Absent when the first attempt held.
 */
export type BakeRecovery = 'retried' | 'lower-detail'

/** What every bake's options share, and what lower detail lowers. */
export interface BakeDetail {
	resolution: number
	samples: number
}

/**
 * Half the texels a side and half the rays: a quarter of the texels, and half
 * the rays each unless the bake already caps them lower.
 */
export function lowerDetail<Options extends BakeDetail>(
	options: Options
): Options {
	return {
		...options,
		resolution: Math.max(1, Math.floor(options.resolution / 2)),
		samples: Math.max(1, Math.round(options.samples / 2))
	}
}

/*
  A reset is the one failure worth repeating: a driver watchdog, memory taken
  by another tab, a backgrounded page. The same bake on a fresh context
  usually holds; when it resets again, less work per texel is what a driver
  under pressure can still finish. Anything else would fail the same way
  twice.
*/
const isReset = (error: unknown, renderer: WebGLRenderer | undefined) =>
	(error instanceof BakeError && error.reason === 'gpu-reset') ||
	Boolean(renderer?.getContext().isContextLost())

/*
  Frees an attempt's renderer and its WebGL context: `dispose` leaves the
  context alive until garbage collection, and a page gets about sixteen.
  Whatever cleaning up throws on a context already gone, the bake's outcome
  stands.
*/
function release(renderer: WebGLRenderer | undefined) {
	// Apart, so a dispose that throws still lets the context go.
	for (const free of [
		() => renderer?.dispose(),
		() => renderer?.forceContextLoss()
	]) {
		try {
			free()
		} catch {
			// Nothing left to free.
		}
	}
}

/**
 * Runs a bake with the renderers it needs and repairs a GPU reset on its
 * own: once again as asked, then once at `lowerDetail`. Each attempt gets a
 * renderer of its own, made only if the bake asks for one and released
 * however the attempt ends, so a reset never reaches the next attempt or the
 * next bake. Resolves either way: the report, with how it recovered if it
 * had to, or why it drew nothing.
 */
export async function bakeWithRecovery<
	Options extends BakeDetail,
	Report extends object
>(
	bake: (renderer: () => WebGLRenderer, options: Options) => Promise<Report>,
	makeRenderer: () => WebGLRenderer,
	options: Options
): Promise<(Report & { recovered?: BakeRecovery }) | BakeFailure> {
	const attempts: { options: Options; recovered?: BakeRecovery }[] = [
		{ options },
		{ options, recovered: 'retried' },
		{ options: lowerDetail(options), recovered: 'lower-detail' }
	]
	let reset: BakeFailure | undefined
	for (const attempt of attempts) {
		let renderer: WebGLRenderer | undefined
		let rendererFailed = false
		const lazyRenderer = () => {
			if (renderer) return renderer
			try {
				return (renderer = makeRenderer())
			} catch (error) {
				rendererFailed = true
				throw error
			}
		}
		try {
			const report = await bake(lazyRenderer, attempt.options)
			return attempt.recovered
				? { ...report, recovered: attempt.recovered }
				: report
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error)
			// A browser may refuse new contexts for a while after a reset, so a
			// renderer that cannot be made then is still the reset's doing.
			if (rendererFailed) return reset ?? { failed: 'no-webgl', detail }
			if (!isReset(error, renderer)) return { failed: 'unexpected', detail }
			reset = { failed: 'gpu-reset', detail }
		} finally {
			release(renderer)
		}
	}
	return reset!
}
