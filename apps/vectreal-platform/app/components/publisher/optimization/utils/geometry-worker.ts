import type {
	WorkerInputMessage,
	WorkerOptimizationOptions,
	WorkerOutputMessage
} from '../../../../workers/optimization.worker.types'

export const OPTIMIZATION_STEP_TIMEOUT_MS = 90_000
export const MODEL_SYNC_TIMEOUT_MS = 60_000

/**
 * Runs geometry-level optimizations (simplify/dedup/quantize/normals) in a Web
 * Worker so the main thread stays responsive. Texture compression is handled
 * separately in the main thread via browser-native OffscreenCanvas encoding.
 *
 * @param inputBuffer  Current model as GLB bytes
 * @param options      Which non-texture steps to run
 * @param onProgress   Called with step label + 0–100 progress each update
 * @returns            Optimized GLB bytes
 */
export async function runGeometryOptimizationsInWorker(
	inputBuffer: Uint8Array,
	options: WorkerOptimizationOptions,
	onProgress: (step: string, progress: number) => void
): Promise<Uint8Array> {
	return new Promise<Uint8Array>((resolve, reject) => {
		const worker = new Worker(
			new URL('../../../../workers/optimization.worker.ts', import.meta.url),
			{ type: 'module' }
		)

		worker.onmessage = (event: MessageEvent<WorkerOutputMessage>) => {
			const msg = event.data
			switch (msg.type) {
				case 'progress':
					onProgress(msg.step, msg.progress)
					break
				case 'done':
					worker.terminate()
					resolve(new Uint8Array(msg.buffer))
					break
				case 'error':
					worker.terminate()
					reject(new Error(msg.message))
					break
			}
		}

		worker.onerror = (err) => {
			worker.terminate()
			reject(new Error(err.message ?? 'Optimization worker crashed'))
		}

		const transferBuffer = inputBuffer.buffer.slice(
			inputBuffer.byteOffset,
			inputBuffer.byteOffset + inputBuffer.byteLength
		) as ArrayBuffer
		const msg: WorkerInputMessage = {
			type: 'optimize',
			buffer: transferBuffer,
			options
		}
		worker.postMessage(msg, [transferBuffer])
	})
}
