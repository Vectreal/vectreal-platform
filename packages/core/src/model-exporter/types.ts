/* vectreal-core | @vctrl/core
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

import type { SerializedAsset } from '../types'
import type { GeometryCodec, GeometryCodecSizes } from './geometry-codec'
import type { Document } from '@gltf-transform/core'
import type { DracoOptions } from '@gltf-transform/functions'

export interface GLBExportResult {
	/** Exported binary data for GLB */
	data: Uint8Array
	/** Export format */
	format: 'glb'
	/** File size in bytes */
	size: number
	/** Export duration in milliseconds */
	exportTime: number
}

export interface PublishExportOptions {
	/** Draco settings; absent when geometry compression is off. */
	draco?: DracoOptions
	/** False when the optimizer measured Draco larger than the plain GLB. */
	dracoWorthApplying?: boolean
	/** Rewrites the export clone's textures, before geometry is encoded. */
	textures?: (document: Document) => Promise<void>
}

export interface PublishExportResult extends GLBExportResult {
	geometryCodec: GeometryCodec
	/** What each codec measured; absent when geometry compression is off. */
	geometrySizes?: GeometryCodecSizes
}

export interface GLTFExportResult {
	/** Exported GLTF JSON data */
	data: object
	/** Export format */
	format: 'gltf'
	/** File size in bytes */
	size: number
	/** Export duration in milliseconds */
	exportTime: number
	/** Additional files (textures, buffers for GLTF) */
	assets?: Map<string, Uint8Array>
}

/**
 * Serialized GLTF export result for JSON transfer.
 * Used when Map<string, Uint8Array> needs to be serialized for API transport.
 */
export interface SerializedGLTFExportResult {
	/** Exported GLTF JSON data */
	data: Record<string, unknown>
	/** Export format */
	format: 'gltf'
	/** File size in bytes */
	size: number
	/** Export duration in milliseconds */
	exportTime: number
	/** Additional files as serialized assets */
	assets?: SerializedAsset[]
	/** Asset IDs map for tracking uploaded assets */
	assetIds?: Map<string, number>
}

export interface USDZExportResult {
	/** Exported binary data for USDZ */
	data: Uint8Array
	/** Export format */
	format: 'usdz'
	/** File size in bytes */
	size: number
	/** Export duration in milliseconds */
	exportTime: number
}

/** Any result `ModelExporter#saveToFile` can persist. */
export type ExportResult = GLBExportResult | GLTFExportResult | USDZExportResult
