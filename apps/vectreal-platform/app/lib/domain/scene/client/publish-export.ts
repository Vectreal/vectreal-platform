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

/**
 * Runs the publish export in its worker. As in `runGeometryOptimizationsInWorker`,
 * the timeout lives here because only this scope can terminate the worker,
 * and an encode left running after a timeout would stack with the retry.
 */
export function runPublishExportInWorker(
	request: Omit<PublishExportRequest, 'type'>,
	onProgress: (progress: PublishExportProgress) => void,
	timeoutMs = PUBLISH_EXPORT_TIMEOUT_MS
): Promise<PublishExportOutcome> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(
			new URL('../../../../workers/publish-export.worker.ts', import.meta.url),
			{ type: 'module' }
		)

		const settle = (finish: () => void) => {
			clearTimeout(timer)
			worker.terminate()
			finish()
		}

		const timer = setTimeout(() => {
			settle(() =>
				reject(new Error(`Publishing timed out after ${timeoutMs / 1000}s`))
			)
		}, timeoutMs)

		worker.onmessage = ({ data }: MessageEvent<PublishExportMessage>) => {
			switch (data.type) {
				case 'progress':
					onProgress(data)
					break
				case 'done':
					settle(() => resolve(data))
					break
				case 'error':
					settle(() => reject(new Error(data.message)))
					break
			}
		}

		worker.onmessageerror = () => {
			settle(() =>
				reject(new Error('Publish worker sent an undeserializable message'))
			)
		}

		worker.onerror = (error) => {
			settle(() => reject(new Error(error.message ?? 'Publish worker crashed')))
		}

		const message: PublishExportRequest = { type: 'export', ...request }
		worker.postMessage(message, [request.buffer])
	})
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
