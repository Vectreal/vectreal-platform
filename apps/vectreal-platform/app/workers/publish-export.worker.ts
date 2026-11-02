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
 *
 * A material whose own UVs a bake cannot use is baked in a UV set laid out
 * for it here, once per worker: a second layout in one worker would drift.
 *
 * It also answers which materials each bake could take, with the planners
 * the bakes run, before anything is baked.
 */

import {
	bakeLightsIntoDocument,
	DEFAULT_LIGHT_BAKE_OPTIONS,
	planBakeUvsFor,
	planLightBake
} from '@vctrl/core/light-bake'
import { ModelExporter } from '@vctrl/core/model-exporter'
import {
	bakeOcclusionIntoDocument,
	bakeReport,
	bakeWithRecovery,
	DEFAULT_OCCLUSION_BAKE_OPTIONS,
	planOcclusionBake,
	withoutBakeUvs,
	writeBakeUvs
} from '@vctrl/core/occlusion-bake'
import { WebGLRenderer } from 'three'

import {
	createKtx2EncoderPool,
	ktx2EncodeWorkerCount
} from './ktx2-encoder-pool'

import type {
	PublishExportMessage,
	PublishExportOutcome,
	PublishExportRequest,
	StudioFinishPlanMessage,
	StudioFinishPlanRequest
} from './publish-export.worker.types'
import type { BakeFailure } from '@vctrl/core/occlusion-bake'

function post(
	message: PublishExportMessage | StudioFinishPlanMessage,
	transfer: Transferable[] = []
) {
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

self.onmessage = (
	event: MessageEvent<PublishExportRequest | StudioFinishPlanRequest>
) => {
	if (event.data.type === 'plan') return planStudioFinish(event.data)
	if (event.data.type === 'export') return exportForPublish(event.data)
}

/**
 * Which materials each bake would take, as the bakes themselves plan it,
 * with the UV set an export of both would lay out, planned but not made. An
 * export of one bake lays out no more than that, so it takes at least what
 * the plan says.
 */
async function planStudioFinish({ buffer }: StudioFinishPlanRequest) {
	try {
		const document = await new ModelExporter().readGlbDocument(
			new Uint8Array(buffer)
		)
		const layout = await planBakeUvsFor(document, {
			occlusion: true,
			lights: true
		})
		const occlusion = planOcclusionBake(document, { layout })
		const lights = await planLightBake(document, layout)
		post({
			type: 'done',
			occlusion: bakeReport(document, occlusion.targets, occlusion.skipped),
			lights: bakeReport(document, lights.targets, lights.skipped)
		})
	} catch (error) {
		post({
			type: 'error',
			message:
				error instanceof Error ? error.message : 'Studio finish plan failed'
		})
	}
}

async function exportForPublish({
	buffer,
	draco,
	dracoWorthApplying,
	ktx2,
	occlusion,
	lights,
	generateUvs = true
}: PublishExportRequest) {
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
								// Laid out before either bake, so both bake in the one set.
								let layout = await planBakeUvsFor(document, {
									occlusion,
									lights: Boolean(lights)
								})
								if (layout && !generateUvs) {
									layout = withoutBakeUvs(layout, 'too-detailed')
								}
								if (layout?.primitives.length) {
									post({ type: 'progress', stage: 'uvs' })
									let failure: BakeFailure | undefined
									try {
										await writeBakeUvs(layout)
									} catch (error) {
										// Not the model's size: its WebAssembly would not load, or
										// xatlas refused a part. A fault to report, not to simplify.
										failure = {
											failed: 'unexpected',
											detail:
												error instanceof Error ? error.message : String(error)
										}
									}
									// The layout is done, so its time limit no longer runs.
									post({
										type: 'progress',
										stage: occlusion ? 'occlusion' : 'lights',
										fraction: 0
									})
									if (failure) {
										if (occlusion) occlusionReport = failure
										if (lights) lightsReport = failure
										return
									}
								}
								// Occlusion first: the light bake bakes past it.
								if (occlusion) {
									occlusionReport = await bakeWithRecovery(
										(renderer, options) =>
											bakeOcclusionIntoDocument(
												document,
												renderer,
												options,
												bakeProgress('occlusion'),
												layout
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
												bakeProgress('lights'),
												layout
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
