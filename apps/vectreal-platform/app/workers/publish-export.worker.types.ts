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

import type {
	GeometryCodec,
	GeometryCodecSizes,
	PublishExportOptions
} from '@vctrl/core/model-exporter'
import type { Ktx2CompressionReport } from '@vctrl/core/model-optimizer'

/** Message sent TO the worker. The buffer should be transferred. */
export interface PublishExportRequest {
	type: 'export'
	/** The working document as an uncompressed GLB. */
	buffer: ArrayBuffer
	draco?: PublishExportOptions['draco']
	dracoWorthApplying: boolean
	ktx2: boolean
}

export interface PublishExportProgress {
	/** Textures encoded so far, out of `total`, while KTX2 runs. */
	texturesDone: number
	texturesTotal: number
}

export interface PublishExportOutcome {
	buffer: ArrayBuffer
	geometryCodec: GeometryCodec
	geometrySizes?: GeometryCodecSizes
	/** Image bytes the published GLB carries. */
	textureBytes: number
	/** Present when KTX2 encoding ran. */
	textures?: Ktx2CompressionReport
}

/** Messages received FROM the worker. */
export type PublishExportMessage =
	| ({ type: 'progress' } & PublishExportProgress)
	| ({ type: 'done' } & PublishExportOutcome)
	| { type: 'error'; message: string }
