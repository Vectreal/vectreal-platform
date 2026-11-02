import {
	BAKE_STALL_TIMEOUT_MS,
	PUBLISH_EXPORT_TIMEOUT_MS,
	UV_LAYOUT_TIMEOUT_MS
} from './studio-finish-reasons'
import { runWorker, WorkerRunError } from '../../../../workers/run-worker'

import type {
	PublishExportMessage,
	PublishExportOutcome,
	PublishExportProgress,
	PublishExportRequest,
	StudioFinishPlan,
	StudioFinishPlanMessage,
	StudioFinishPlanRequest
} from '../../../../workers/publish-export.worker.types'
import type { DracoCompressionReport, Optimizations } from '@vctrl/core'

/** The request a caller makes: the working GLB's bytes, not a buffer to give away. */
export type PublishExportInput = Omit<
	PublishExportRequest,
	'type' | 'buffer'
> & {
	glb: Uint8Array
}

/** A UV layout ran past `UV_LAYOUT_TIMEOUT_MS`, so its worker was stopped. */
class UvLayoutTimedOut extends Error {}

/** A bake went `BAKE_STALL_TIMEOUT_MS` without reporting, so its worker was stopped. */
class BakeStalled extends Error {
	constructor(
		readonly stage: 'occlusion' | 'lights',
		message: string
	) {
		super(message)
	}
}

/**
 * Runs the publish export in a worker. A worker that crashes, which is the
 * browser running out of memory, is run once more: `runWorker` has already
 * terminated it, and with it the copy it was given, so the retry gets a fresh
 * copy without two ever being alive. A timeout is not retried; it would only
 * take as long again. The budget (`PUBLISH_EXPORT_TIMEOUT_MS`) is generous,
 * since KTX2 takes seconds per texture; it exists so a stuck encoder cannot
 * hold the publish button forever.
 *
 * Laying out a UV set for the bakes is one call that cannot be stopped from
 * inside, so its own limit stops the worker, and the export runs again
 * without it, its materials reported as too detailed. A layout that crashed
 * the worker is not tried again either, and neither is one that ran out of
 * time when the run after it crashes.
 *
 * A bake that stops reporting is stopped the same way, and the export runs
 * again without it, reporting it as stalled, as a bake that failed on the
 * GPU publishes the model without it.
 */
export async function runPublishExportInWorker(
	input: PublishExportInput,
	onProgress: (progress: PublishExportProgress) => void,
	timeoutMs = PUBLISH_EXPORT_TIMEOUT_MS,
	uvLayoutTimeoutMs = UV_LAYOUT_TIMEOUT_MS,
	stallTimeoutMs = BAKE_STALL_TIMEOUT_MS
): Promise<PublishExportOutcome> {
	let request = input
	let laying = false
	let stalled: Pick<PublishExportOutcome, 'occlusion' | 'lights'> | undefined
	const withoutLayout = () => {
		request = { ...request, generateUvs: false }
	}
	const run = () => {
		laying = false
		return runPublishExportOnce(
			request,
			(progress) => {
				laying = progress.stage === 'uvs'
				onProgress(progress)
			},
			{ timeoutMs, uvLayoutTimeoutMs, stallTimeoutMs }
		)
	}
	// Each limit turns something off, so this runs at most once per layout
	// and once per bake.
	const runWithinLimits = async (): Promise<PublishExportOutcome> => {
		try {
			const outcome = await run()
			return stalled ? { ...outcome, ...stalled } : outcome
		} catch (error) {
			if (error instanceof UvLayoutTimedOut) {
				withoutLayout()
			} else if (error instanceof BakeStalled) {
				stalled = {
					...stalled,
					[error.stage]: { failed: 'stalled', detail: error.message }
				}
				request = { ...request, [error.stage]: false }
			} else {
				throw error
			}
			return runWithinLimits()
		}
	}
	try {
		return await runWithinLimits()
	} catch (error) {
		if (!(error instanceof WorkerRunError && error.failure === 'crashed')) {
			throw error
		}
		if (laying) withoutLayout()
		return runWithinLimits()
	}
}

const createPublishWorker = () =>
	new Worker(
		new URL('../../../../workers/publish-export.worker.ts', import.meta.url),
		{ type: 'module' }
	)

/**
 * Which materials each bake of the studio finish could take in the working
 * GLB, planned in the publish worker by the planners the bakes run. Planning
 * reads every triangle's UVs, a few hundred milliseconds on a large model,
 * so it stays off the main thread.
 */
export function planStudioFinishInWorker(
	glb: Uint8Array,
	timeoutMs = PUBLISH_EXPORT_TIMEOUT_MS
): Promise<StudioFinishPlan> {
	const buffer = glb.slice().buffer as ArrayBuffer
	const message: StudioFinishPlanRequest = { type: 'plan', buffer }
	return runWorker<StudioFinishPlanMessage, StudioFinishPlan>(
		createPublishWorker,
		{
			message,
			transfer: [buffer],
			timeoutMs,
			onProgress: () => {},
			toResult: ({ occlusion, lights }) => ({ occlusion, lights }),
			errors: {
				timedOut: `Planning the studio finish timed out after ${timeoutMs / 1000}s`,
				undeserializable: 'Publish worker sent an undeserializable message',
				crashed: 'Publish worker crashed'
			}
		}
	)
}

/**
 * The error a quiet stage is stopped with, when that stage has a limit of
 * its own: a layout until its end, a bake until its next report.
 */
function stageLimit(
	progress: PublishExportProgress,
	{ uvLayoutTimeoutMs, stallTimeoutMs }: RunLimits
): { ms: number; error: () => Error } | undefined {
	if (progress.stage === 'uvs') {
		return {
			ms: uvLayoutTimeoutMs,
			error: () =>
				new UvLayoutTimedOut(
					`Laying out UVs timed out after ${uvLayoutTimeoutMs / 1000}s`
				)
		}
	}
	// Encoding reports per texture, and not at all for geometry, so only the
	// export's own budget bounds it, as it does whatever follows a bake.
	if (progress.stage === 'textures' || progress.ended) return undefined
	const { stage, fraction, gpuTimer } = progress
	return {
		ms: stallTimeoutMs,
		error: () =>
			new BakeStalled(
				stage,
				`${stage} made no progress for ${stallTimeoutMs / 1000}s at ${(fraction * 100).toFixed(2)}% (GPU timer: ${gpuTimer === undefined ? 'unknown' : gpuTimer ? 'yes' : 'no'})`
			)
	}
}

interface RunLimits {
	timeoutMs: number
	uvLayoutTimeoutMs: number
	stallTimeoutMs: number
}

/**
 * One run, in a worker `runWorker` owns, handed a copy of the GLB to keep.
 * A stage's limit runs from its progress until the next, and only while the
 * page is shown: a hidden page's worker may be paused, and the time away is
 * not the stage's.
 */
async function runPublishExportOnce(
	{ glb, ...request }: PublishExportInput,
	onProgress: (progress: PublishExportProgress) => void,
	limits: RunLimits
): Promise<PublishExportOutcome> {
	const buffer = glb.slice().buffer as ArrayBuffer
	const message: PublishExportRequest = { type: 'export', buffer, ...request }
	const stopped = new AbortController()
	let limit: ReturnType<typeof stageLimit>
	let limitTimer: ReturnType<typeof setTimeout> | undefined
	const arm = () => {
		clearTimeout(limitTimer)
		if (!limit || document.hidden) return
		const { ms, error } = limit
		limitTimer = setTimeout(() => stopped.abort(error()), ms)
	}
	document.addEventListener('visibilitychange', arm)

	try {
		return await runWorker<PublishExportMessage, PublishExportOutcome>(
			createPublishWorker,
			{
				message,
				transfer: [buffer],
				timeoutMs: limits.timeoutMs,
				signal: stopped.signal,
				onProgress: (progress) => {
					limit = stageLimit(progress, limits)
					arm()
					onProgress(progress)
				},
				toResult: (outcome) => outcome,
				errors: {
					timedOut: `Publishing timed out after ${limits.timeoutMs / 1000}s`,
					undeserializable: 'Publish worker sent an undeserializable message',
					crashed: 'Publish worker crashed'
				}
			}
		)
	} finally {
		clearTimeout(limitTimer)
		document.removeEventListener('visibilitychange', arm)
	}
}

/** How publish encodes geometry, from the settings the document was derived from. */
export type PublishGeometryOptions = Pick<
	PublishExportRequest,
	'draco' | 'dracoWorthApplying'
>

/**
 * Geometry and texture codecs are applied at publish rather than during
 * optimization: the working document stays uncompressed WebP, so editing and
 * re-optimizing never re-encode (and degrade) it. Draco is the switch for
 * geometry compression as a whole; `isWorthApplying` is false when the
 * measured compression came out larger than the plain GLB, which leaves
 * meshopt to compete with plain geometry alone. Settings saved before a step
 * existed lack it, so Draco may be absent.
 */
export function resolvePublishGeometryOptions(
	optimizations: Optimizations,
	dracoReport: DracoCompressionReport | null
): PublishGeometryOptions {
	const { enabled: dracoEnabled = false, ...dracoOptions } =
		optimizations.draco ?? {}
	return {
		draco: dracoEnabled ? dracoOptions : undefined,
		dracoWorthApplying: dracoReport?.isWorthApplying !== false
	}
}

/**
 * The size `workingGlb` publishes at, encoded the way publish encodes it.
 * Exact except for GPU texture encoding and baked occlusion, which take
 * seconds and are left to publish: without them, publish ships the textures
 * as they are.
 */
export async function projectPublishedGlbBytes(
	workingGlb: Uint8Array,
	geometry: PublishGeometryOptions
): Promise<number> {
	const { buffer } = await runPublishExportInWorker(
		{
			glb: workingGlb,
			...geometry,
			ktx2: false,
			occlusion: false,
			lights: false
		},
		() => {}
	)
	return buffer.byteLength
}
