/* vectreal-platform | Publish Export Web Worker
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
 * Encodes the GLB a scene is published as, off the main thread: ambient
 * occlusion and the studio lights baked in when asked, textures to KTX2, then geometry in whichever
 * of Draco and meshopt ships it cheapest.
 * Each is seconds of CPU per texture or mesh, and on the main thread that was
 * a frozen publisher.
 */

import { bakeLightsIntoDocument } from '@vctrl/core/light-bake'
import { ModelExporter } from '@vctrl/core/model-exporter'
import { bakeOcclusionIntoDocument } from '@vctrl/core/occlusion-bake'
import { WebGLRenderer } from 'three'

import {
	createKtx2EncoderPool,
	ktx2EncodeWorkerCount
} from './ktx2-encoder-pool'

import type {
	PublishExportMessage,
	PublishExportOutcome,
	PublishExportRequest
} from './publish-export.worker.types'

/** A failed bake publishes the model without it, so its error is reported, not thrown. */
async function attempt<T>(
	bake: () => Promise<T>,
	fallback: string
): Promise<T | { failed: string }> {
	try {
		return await bake()
	} catch (error) {
		return { failed: error instanceof Error ? error.message : fallback }
	}
}

function post(message: PublishExportMessage, transfer: Transferable[] = []) {
	self.postMessage(message, { transfer })
}

self.onmessage = async (event: MessageEvent<PublishExportRequest>) => {
	const { type, buffer, draco, dracoWorthApplying, ktx2, occlusion, lights } =
		event.data
	if (type !== 'export') return

	let occlusionReport: PublishExportOutcome['occlusion']
	let lightsReport: PublishExportOutcome['lights']
	// One renderer for both bakes, on a canvas nothing displays, made only
	// when a bake has something to bake.
	let renderer: WebGLRenderer | undefined
	const bakeRenderer = () =>
		(renderer ??= new WebGLRenderer({ canvas: new OffscreenCanvas(1, 1) }))
	// Textures encode in workers of their own, several at once.
	const encoders = ktx2
		? createKtx2EncoderPool(
				() =>
					new Worker(new URL('./ktx2-encode.worker.ts', import.meta.url), {
						type: 'module'
					})
			)
		: undefined
	try {
		const result = await new ModelExporter().exportGlbForPublish(
			new Uint8Array(buffer),
			{
				draco,
				dracoWorthApplying,
				bake:
					occlusion || lights
						? async (document) => {
								// Occlusion first: the light bake bakes past it.
								if (occlusion) {
									occlusionReport = await attempt(
										() => bakeOcclusionIntoDocument(document, bakeRenderer),
										'Occlusion bake failed'
									)
								}
								if (lights) {
									lightsReport = await attempt(
										() =>
											bakeLightsIntoDocument(document, lights, bakeRenderer),
										'Light bake failed'
									)
								}
							}
						: undefined,
				ktx2: encoders
					? {
							encode: encoders.encode,
							concurrency: ktx2EncodeWorkerCount(),
							onProgress: (texturesDone, texturesTotal) =>
								post({ type: 'progress', texturesDone, texturesTotal })
						}
					: undefined
			}
		)

		const output = result.data.buffer.slice(
			result.data.byteOffset,
			result.data.byteOffset + result.data.byteLength
		) as ArrayBuffer
		post(
			{
				type: 'done',
				buffer: output,
				geometryCodec: result.geometryCodec,
				geometrySizes: result.geometrySizes,
				textureBytes: result.textureBytes,
				textures: result.textures,
				occlusion: occlusionReport,
				lights: lightsReport
			},
			[output]
		)
	} catch (error) {
		post({
			type: 'error',
			message: error instanceof Error ? error.message : 'Publish export failed'
		})
	} finally {
		renderer?.dispose()
		encoders?.dispose()
	}
}
