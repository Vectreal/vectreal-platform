/* vectreal-platform | Optimization Web Worker
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>. */

/**
 * Optimization Web Worker
 *
 * Runs geometry-level 3D model optimizations off the main thread using
 * @vctrl/core's ModelOptimizer, keeping the UI responsive during
 * CPU-intensive operations like mesh simplification and quantization.
 *
 * Texture compression is handled separately on the main thread via
 * browser-native OffscreenCanvas encoding in @vctrl/hooks.
 *
 * Usage:
 *   const worker = new Worker(
 *     new URL('./optimization.worker.ts', import.meta.url),
 *     { type: 'module' }
 *   )
 *   worker.postMessage({ type: 'optimize', buffer, options }, [buffer])
 *   worker.onmessage = ({ data }) => { ... }
 *   worker.terminate()
 */

import { ModelOptimizer } from '@vctrl/core/model-optimizer'

import { GEOMETRY_STEP_ORDER } from './optimization.worker.types'

import type {
	GeometryOptimizationKey,
	WorkerOptimizationOptions,
	WorkerInputMessage,
	WorkerOutputMessage
} from './optimization.worker.types'
import type { DracoCompressionReport } from '@vctrl/core'

export type {
	WorkerOptimizationOptions,
	WorkerInputMessage,
	WorkerOutputMessage
}

/**
 * How each step is run. Options pass straight through — they are already the
 * glTF-Transform shapes, minus the `enabled` flag the main thread strips.
 *
 * Draco is the odd one out: it measures rather than mutates, so it returns a
 * report. The working document stays uncompressed, which keeps the main thread
 * from having to decode it back and lets compression happen once, at export.
 */
const STEP_RUNNERS: {
	[Key in GeometryOptimizationKey]: (
		optimizer: ModelOptimizer,
		options: NonNullable<WorkerOptimizationOptions[Key]>
	) => Promise<DracoCompressionReport | void>
} = {
	simplification: (optimizer, options) => optimizer.simplify(options),
	dedup: (optimizer, options) => optimizer.deduplicate(options),
	quantize: (optimizer, options) => optimizer.quantize(options),
	normals: (optimizer, options) => optimizer.optimizeNormals(options),
	draco: (optimizer, options) => optimizer.measureDracoCompression(options)
}

function post(msg: WorkerOutputMessage, transfer?: Transferable[]) {
	if (transfer?.length) {
		self.postMessage(msg, { transfer })
	} else {
		self.postMessage(msg)
	}
}

self.onmessage = async (event: MessageEvent<WorkerInputMessage>) => {
	const { type, buffer, options } = event.data

	if (type !== 'optimize') return

	const optimizer = new ModelOptimizer()

	// The optimizer emits fine-grained progress inside each step. Relay it under
	// whichever step is running so long steps (Draco especially) show movement
	// instead of jumping 0 → 100.
	let activeStep: GeometryOptimizationKey | null = null
	optimizer.onProgress(({ progress }) => {
		if (activeStep) post({ type: 'progress', step: activeStep, progress })
	})

	try {
		await optimizer.loadFromBuffer(new Uint8Array(buffer))

		let dracoReport: DracoCompressionReport | undefined

		for (const step of GEOMETRY_STEP_ORDER) {
			const stepOptions = options[step]
			if (!stepOptions) continue

			activeStep = step
			post({ type: 'progress', step, progress: 0 })
			try {
				const result = await (
					STEP_RUNNERS[step] as (
						optimizer: ModelOptimizer,
						options: typeof stepOptions
					) => Promise<DracoCompressionReport | void>
				)(optimizer, stepOptions)

				if (step === 'draco' && result) {
					dracoReport = result
				}
			} finally {
				activeStep = null
			}
			post({ type: 'progress', step, progress: 100 })
		}

		const result = await optimizer.export()
		// Transfer ownership of the underlying ArrayBuffer to avoid copying
		post(
			{
				type: 'done',
				buffer: result.buffer as ArrayBuffer,
				appliedOptimizations: optimizer.getAppliedOptimizations(),
				dracoReport
			},
			[result.buffer as ArrayBuffer]
		)
	} catch (err) {
		post({
			type: 'error',
			message: err instanceof Error ? err.message : 'Unknown optimization error'
		})
	}
}
