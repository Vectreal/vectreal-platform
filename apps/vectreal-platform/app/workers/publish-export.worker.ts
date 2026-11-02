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

import {
	bakeLightsIntoDocument,
	DEFAULT_LIGHT_BAKE_OPTIONS
} from '@vctrl/core/light-bake'
import { ModelExporter } from '@vctrl/core/model-exporter'
import {
	bakeOcclusionIntoDocument,
	bakeWithRecovery,
	DEFAULT_OCCLUSION_BAKE_OPTIONS
} from '@vctrl/core/occlusion-bake'
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

function post(message: PublishExportMessage, transfer: Transferable[] = []) {
	self.postMessage(message, { transfer })
}

/** How often a bake reports, at most: a slice ends every few milliseconds. */
const BAKE_PROGRESS_INTERVAL_MS = 100

/** Posts how far a bake has drawn, throttled, and always its end. */
function bakeProgress(stage: 'occlusion' | 'lights') {
	let postedAt = -Infinity
	return (fraction: number) => {
		const now = performance.now()
		if (fraction < 1 && now - postedAt < BAKE_PROGRESS_INTERVAL_MS) return
		postedAt = now
		post({ type: 'progress', stage, fraction })
	}
}

self.onmessage = async (event: MessageEvent<PublishExportRequest>) => {
	const { type, buffer, draco, dracoWorthApplying, ktx2, occlusion, lights } =
		event.data
	if (type !== 'export') return

	let occlusionReport: PublishExportOutcome['occlusion']
	let lightsReport: PublishExportOutcome['lights']
	// On a canvas nothing displays. Each bake attempt makes its own, only when
	// it has something to bake, and `bakeWithRecovery` disposes it, so a GPU
	// reset in one bake never reaches the next. A failed bake publishes the
	// model without it, so its reason is reported, not thrown.
	const bakeRenderer = () =>
		new WebGLRenderer({ canvas: new OffscreenCanvas(1, 1) })
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
									occlusionReport = await bakeWithRecovery(
										(renderer, options) =>
											bakeOcclusionIntoDocument(
												document,
												renderer,
												options,
												bakeProgress('occlusion')
											),
										bakeRenderer,
										DEFAULT_OCCLUSION_BAKE_OPTIONS
									)
								}
								if (lights) {
									lightsReport = await bakeWithRecovery(
										(renderer, options) =>
											bakeLightsIntoDocument(
												document,
												lights,
												renderer,
												options,
												bakeProgress('lights')
											),
										bakeRenderer,
										DEFAULT_LIGHT_BAKE_OPTIONS
									)
								}
							}
						: undefined,
				ktx2: encoders
					? {
							encode: encoders.encode,
							concurrency: ktx2EncodeWorkerCount(),
							onProgress: (texturesDone, texturesTotal) =>
								post({
									type: 'progress',
									stage: 'textures',
									texturesDone,
									texturesTotal
								})
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
		encoders?.dispose()
	}
}
