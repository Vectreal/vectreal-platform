import type {
	PublishExportMessage,
	PublishExportOutcome,
	PublishExportProgress,
	PublishExportRequest
} from '../../../../workers/publish-export.worker.types'

/**
 * Budget for one publish export. KTX2 encoding takes seconds per texture, so
 * this is generous; it exists so a stuck encoder cannot hold the publish
 * button forever.
 */
export const PUBLISH_EXPORT_TIMEOUT_MS = 10 * 60_000

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
