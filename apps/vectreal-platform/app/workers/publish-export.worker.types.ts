/* vectreal-platform | Publish Export Worker Types
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

import type { ResolvedLighting } from '@vctrl/core'
import type { LightBakeReport } from '@vctrl/core/light-bake'
import type {
	GeometryCodec,
	GeometryCodecSizes,
	PublishExportOptions
} from '@vctrl/core/model-exporter'
import type { Ktx2CompressionReport } from '@vctrl/core/model-optimizer'
import type { OcclusionBakeReport } from '@vctrl/core/occlusion-bake'

/** Message sent TO the worker. The buffer should be transferred. */
export interface PublishExportRequest {
	type: 'export'
	/** The working document as an uncompressed GLB. */
	buffer: ArrayBuffer
	draco?: PublishExportOptions['draco']
	dracoWorthApplying: boolean
	ktx2: boolean
	/** Bake ambient occlusion into the published GLB. */
	occlusion: boolean
	/** Bake these studio lights into the published GLB's light maps, or none. */
	lights: Pick<ResolvedLighting, 'lights' | 'environment'> | false
}

export type PublishExportProgress =
	/** Textures encoded so far, out of `texturesTotal`, while KTX2 runs. */
	| { stage: 'textures'; texturesDone: number; texturesTotal: number }
	/** How much of a bake is drawn, 0 to 1. */
	| { stage: 'occlusion' | 'lights'; fraction: number }

export interface PublishExportOutcome {
	buffer: ArrayBuffer
	geometryCodec: GeometryCodec
	geometrySizes?: GeometryCodecSizes
	/** Image bytes the published GLB carries. */
	textureBytes: number
	/** Present when KTX2 encoding ran. */
	textures?: Ktx2CompressionReport
	/**
	 * Present when occlusion was asked for: what was baked, or why nothing was.
	 * A failed bake publishes the model without it rather than not at all.
	 */
	occlusion?: OcclusionBakeReport | { failed: string }
	/** Present when the lights were asked for, as `occlusion` is. */
	lights?: LightBakeReport | { failed: string }
}

/** Messages received FROM the worker. */
export type PublishExportMessage =
	| ({ type: 'progress' } & PublishExportProgress)
	| ({ type: 'done' } & PublishExportOutcome)
	| { type: 'error'; message: string }
