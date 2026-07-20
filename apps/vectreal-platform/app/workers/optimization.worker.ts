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

import type {
	WorkerOptimizationOptions,
	WorkerInputMessage,
	WorkerOutputMessage
} from './optimization.worker.types'

export type {
	WorkerOptimizationOptions,
	WorkerInputMessage,
	WorkerOutputMessage
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

	try {
		await optimizer.loadFromBuffer(new Uint8Array(buffer))

		if (options.simplify?.enabled) {
			post({ type: 'progress', step: 'Mesh simplification', progress: 0 })
			await optimizer.simplify({
				ratio: options.simplify.ratio,
				error: options.simplify.error
			})
			post({ type: 'progress', step: 'Mesh simplification', progress: 100 })
		}

		if (options.dedup?.enabled) {
			post({ type: 'progress', step: 'Duplicate removal', progress: 0 })
			await optimizer.deduplicate({
				textures: options.dedup.textures,
				materials: options.dedup.materials,
				meshes: options.dedup.meshes,
				accessors: options.dedup.accessors
			})
			post({ type: 'progress', step: 'Duplicate removal', progress: 100 })
		}

		if (options.quantize?.enabled) {
			post({ type: 'progress', step: 'Vertex quantization', progress: 0 })
			await optimizer.quantize({
				quantizePosition: options.quantize.quantizePosition,
				quantizeNormal: options.quantize.quantizeNormal,
				quantizeColor: options.quantize.quantizeColor,
				quantizeTexcoord: options.quantize.quantizeTexcoord
			})
			post({ type: 'progress', step: 'Vertex quantization', progress: 100 })
		}

		if (options.normals?.enabled) {
			post({ type: 'progress', step: 'Normal refinement', progress: 0 })
			await optimizer.optimizeNormals({
				overwrite: options.normals.overwrite
			})
			post({ type: 'progress', step: 'Normal refinement', progress: 100 })
		}

		// Runs last: compresses whatever geometry the earlier steps produced.
		if (options.draco?.enabled) {
			post({ type: 'progress', step: 'Draco compression', progress: 0 })
			await optimizer.compressGeometry({
				method: options.draco.method,
				encodeSpeed: options.draco.encodeSpeed,
				decodeSpeed: options.draco.decodeSpeed,
				quantizePosition: options.draco.quantizePosition,
				quantizeNormal: options.draco.quantizeNormal,
				quantizeColor: options.draco.quantizeColor,
				quantizeTexcoord: options.draco.quantizeTexcoord,
				quantizeGeneric: options.draco.quantizeGeneric
			})
			post({ type: 'progress', step: 'Draco compression', progress: 100 })
		}

		const result = await optimizer.export()
		// Transfer ownership of the underlying ArrayBuffer to avoid copying
		post({ type: 'done', buffer: result.buffer as ArrayBuffer }, [
			result.buffer as ArrayBuffer
		])
	} catch (err) {
		post({
			type: 'error',
			message: err instanceof Error ? err.message : 'Unknown optimization error'
		})
	}
}
