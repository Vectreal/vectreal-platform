/* vectreal-platform | KTX2 Encoder Pool
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

import type {
	Ktx2EncodeReply,
	Ktx2EncodeRequest
} from './ktx2-encode.worker.types'
import type { Ktx2Encoder } from '@vctrl/core/model-optimizer'

/**
 * The most encode workers a publish runs. Each holds its own encoder wasm and
 * a texture's pixels at up to 2048², so past this the memory grows for less
 * and less time saved.
 */
export const MAX_KTX2_ENCODE_WORKERS = 4

/** How many encode workers this device runs: one core stays with the page. */
export function ktx2EncodeWorkerCount(
	hardwareConcurrency = navigator.hardwareConcurrency
) {
	return Math.max(
		1,
		Math.min(MAX_KTX2_ENCODE_WORKERS, (hardwareConcurrency || 2) - 1)
	)
}

export interface Ktx2EncoderPool {
	encode: Ktx2Encoder
	/** Ends every worker the pool started. */
	dispose: () => void
}

/**
 * Encode workers, each encoding one texture at a time: an encode takes an idle
 * one or starts another, so the pool grows to as many as are asked for at
 * once and no further. A worker that crashes rejects its encode and is
 * dropped.
 */
export function createKtx2EncoderPool(
	createWorker: () => Worker
): Ktx2EncoderPool {
	const started = new Set<Worker>()
	const idle: Worker[] = []

	const retire = (worker: Worker) => {
		worker.terminate()
		started.delete(worker)
	}

	const encode: Ktx2Encoder = (source, options) => {
		let worker = idle.pop()
		if (!worker) {
			worker = createWorker()
			started.add(worker)
		}
		const busy = worker
		return new Promise<Uint8Array>((resolve, reject) => {
			busy.onmessage = ({ data }: MessageEvent<Ktx2EncodeReply>) => {
				idle.push(busy)
				if ('ktx2' in data) resolve(data.ktx2)
				else reject(new Error(data.error))
			}
			busy.onerror = (event) => {
				event.preventDefault()
				retire(busy)
				reject(new Error(event.message || 'The KTX2 encode worker crashed'))
			}
			busy.onmessageerror = () => {
				retire(busy)
				reject(new Error('The KTX2 encode worker sent an unreadable reply'))
			}
			const request: Ktx2EncodeRequest = { source, options }
			busy.postMessage(request)
		})
	}

	return {
		encode,
		dispose: () => {
			for (const worker of started) worker.terminate()
			started.clear()
			idle.length = 0
		}
	}
}
