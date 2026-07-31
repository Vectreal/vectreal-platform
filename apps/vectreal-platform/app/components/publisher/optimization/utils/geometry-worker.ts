import type {
	GeometryOptimizationKey,
	WorkerInputMessage,
	WorkerOptimizationOptions,
	WorkerOutputMessage
} from '../../../../workers/optimization.worker.types'
import type { DracoCompressionReport } from '@vctrl/core'

export const OPTIMIZATION_STEP_TIMEOUT_MS = 90_000
export const MODEL_SYNC_TIMEOUT_MS = 60_000

export interface GeometryOptimizationResult {
	/** Optimized GLB bytes, always uncompressed. */
	buffer: Uint8Array
	/** Steps the worker's optimizer kept, for the main-thread report. */
	appliedOptimizations: string[]
	/** Draco measurement, when Draco compression was requested. */
	dracoReport?: DracoCompressionReport
}

/**
 * Runs geometry-level optimizations (simplify/dedup/quantize/normals/Draco) in
 * a Web Worker so the main thread stays responsive. Texture compression is
 * handled separately in the main thread via browser-native OffscreenCanvas
 * encoding.
 *
 * The worker's optimizer state dies with the worker, so its report has to come
 * back alongside the bytes — the main thread can't recover it from the GLB.
 *
 * @param inputBuffer  Current model as GLB bytes
 * @param options      Which non-texture steps to run
 * @param onProgress   Called with the step key + 0–100 progress each update.
 *                     The worker reports keys, not labels, so UI copy stays on
 *                     the main thread.
 */
export async function runGeometryOptimizationsInWorker(
	inputBuffer: Uint8Array,
	options: WorkerOptimizationOptions,
	onProgress: (step: GeometryOptimizationKey, progress: number) => void
): Promise<GeometryOptimizationResult> {
	return new Promise<GeometryOptimizationResult>((resolve, reject) => {
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
					resolve({
						buffer: new Uint8Array(msg.buffer),
						appliedOptimizations: msg.appliedOptimizations,
						dracoReport: msg.dracoReport
					})
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
