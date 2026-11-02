import { PUBLISH_EXPORT_TIMEOUT_MS } from './studio-finish-reasons'
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

/**
 * Runs the publish export in a worker. A worker that crashes, which is the
 * browser running out of memory, is run once more: `runWorker` has already
 * terminated it, and with it the copy it was given, so the retry gets a fresh
 * copy without two ever being alive. A timeout is not retried; it would only
 * take as long again. The budget (`PUBLISH_EXPORT_TIMEOUT_MS`) is generous,
 * since KTX2 takes seconds per texture; it exists so a stuck encoder cannot
 * hold the publish button forever.
 */
export async function runPublishExportInWorker(
	input: PublishExportInput,
	onProgress: (progress: PublishExportProgress) => void,
	timeoutMs = PUBLISH_EXPORT_TIMEOUT_MS
): Promise<PublishExportOutcome> {
	try {
		return await runPublishExportOnce(input, onProgress, timeoutMs)
	} catch (error) {
		if (!(error instanceof WorkerRunError && error.failure === 'crashed')) {
			throw error
		}
		return runPublishExportOnce(input, onProgress, timeoutMs)
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

/** One run, in a worker `runWorker` owns, handed a copy of the GLB to keep. */
function runPublishExportOnce(
	{ glb, ...request }: PublishExportInput,
	onProgress: (progress: PublishExportProgress) => void,
	timeoutMs: number
): Promise<PublishExportOutcome> {
	const buffer = glb.slice().buffer as ArrayBuffer
	const message: PublishExportRequest = { type: 'export', buffer, ...request }

	return runWorker<PublishExportMessage, PublishExportOutcome>(
		createPublishWorker,
		{
			message,
			transfer: [buffer],
			timeoutMs,
			onProgress,
			toResult: (outcome) => outcome,
			errors: {
				timedOut: `Publishing timed out after ${timeoutMs / 1000}s`,
				undeserializable: 'Publish worker sent an undeserializable message',
				crashed: 'Publish worker crashed'
			}
		}
	)
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
