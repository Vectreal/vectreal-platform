import { runWorker } from '../../../../workers/run-worker'

import type {
	PublishExportMessage,
	PublishExportOutcome,
	PublishExportProgress,
	PublishExportRequest
} from '../../../../workers/publish-export.worker.types'
import type { DracoCompressionReport, Optimizations } from '@vctrl/core'

/**
 * Budget for one publish export. KTX2 encoding takes seconds per texture, so
 * this is generous; it exists so a stuck encoder cannot hold the publish
 * button forever.
 */
const PUBLISH_EXPORT_TIMEOUT_MS = 10 * 60_000

/** Runs the publish export in its worker, which `runWorker` owns. */
export function runPublishExportInWorker(
	request: Omit<PublishExportRequest, 'type'>,
	onProgress: (progress: PublishExportProgress) => void,
	timeoutMs = PUBLISH_EXPORT_TIMEOUT_MS
): Promise<PublishExportOutcome> {
	const message: PublishExportRequest = { type: 'export', ...request }

	return runWorker<PublishExportMessage, PublishExportOutcome>(
		() =>
			new Worker(
				new URL(
					'../../../../workers/publish-export.worker.ts',
					import.meta.url
				),
				{ type: 'module' }
			),
		{
			message,
			transfer: [request.buffer],
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
 * Exact except for GPU texture encoding, which takes seconds per texture and
 * is left to publish: without it, publish ships the textures as they are.
 */
export async function projectPublishedGlbBytes(
	workingGlb: Uint8Array,
	geometry: PublishGeometryOptions
): Promise<number> {
	const { buffer } = await runPublishExportInWorker(
		{
			buffer: workingGlb.slice().buffer as ArrayBuffer,
			...geometry,
			ktx2: false
		},
		() => {}
	)
	return buffer.byteLength
}
