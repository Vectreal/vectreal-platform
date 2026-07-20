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

import type { BeforeAfterMetric } from '../types'

export interface SimplifyOptions {
	/** The simplification ratio (0.0 to 1.0) */
	ratio?: number
	/** The simplification error value */
	error?: number
}

export interface DedupOptions {
	/** Whether to deduplicate textures */
	textures?: boolean
	/** Whether to deduplicate materials */
	materials?: boolean
	/** Whether to deduplicate meshes */
	meshes?: boolean
	/** Whether to deduplicate accessors */
	accessors?: boolean
}

export interface QuantizeOptions {
	/** Position quantization bits */
	quantizePosition?: number
	/** Normal quantization bits */
	quantizeNormal?: number
	/** Color quantization bits */
	quantizeColor?: number
	/** Texture coordinate quantization bits */
	quantizeTexcoord?: number
}

export interface NormalsOptions {
	/** Whether to overwrite existing normals */
	overwrite?: boolean
}

export interface DracoOptions {
	/** Compression method. Edgebreaker gives higher compression; sequential preserves vertex order. */
	method?: 'edgebreaker' | 'sequential'
	/** Encoder speed (0-10, slower = smaller). */
	encodeSpeed?: number
	/** Decoder speed (0-10). */
	decodeSpeed?: number
	/** Position quantization bits. */
	quantizePosition?: number
	/** Normal quantization bits. */
	quantizeNormal?: number
	/** Color quantization bits. */
	quantizeColor?: number
	/** Texture coordinate quantization bits. */
	quantizeTexcoord?: number
	/** Generic attribute quantization bits. */
	quantizeGeneric?: number
}

export interface TextureCompressOptions {
	/**
	 * Custom image encoder compatible with the sharp constructor API.
	 * When provided, sharp is not imported — enabling use in browser and edge
	 * environments. Must implement:
	 * `(buffer) => { resize, webp, jpeg, png, toBuffer, metadata }`.
	 *
	 * In browser contexts, pass `createBrowserTextureEncoder()` from `@vctrl/hooks`.
	 */
	encoder?: unknown
	/** Maximum texture size */
	resize?: [number, number]
	/** Target texture format */
	targetFormat?: 'webp' | 'jpeg' | 'png'
	/** Compression quality (0-100) */
	quality?: number
}

export interface TextureDescriptor {
	index: number
	fileName: string
	name: string
	mimeType: string
	byteLength: number
}

export interface TextureBinaryPayload {
	index: number
	fileName: string
	name: string
	mimeType: string
	image: Uint8Array
}

/**
 * Canonical optimization metrics payload used by OptimizationReport.
 *
 * Conventions:
 * - `textures` holds texture payload bytes.
 * - `texturesCount` holds the number of texture assets.
 * - `vertices`, `triangles`, `meshes`, `materials`, `nodes` are all counts.
 */
export interface OptimizationStats {
	vertices: BeforeAfterMetric
	triangles: BeforeAfterMetric
	materials: BeforeAfterMetric
	/** Texture payload size in bytes (before/after). */
	textures: BeforeAfterMetric
	/** Number of texture assets (before/after). */
	texturesCount: BeforeAfterMetric
	textureResolutions: {
		before: string[]
		after: string[]
	}
	meshes: BeforeAfterMetric
	nodes: BeforeAfterMetric
}

/**
 * Draco geometry-compression metrics. Populated only when `compressGeometry`
 * ran and was kept (not reverted for making the export bigger). Distinct
 * from `OptimizationStats.meshes`, which always reflects uncompressed
 * geometry byte size — Draco compression is deferred until write time, so
 * `inspect()` can't see it.
 */
export interface DracoCompressionReport {
	/** Uncompressed geometry payload size in bytes, before compression. */
	geometryBytesBefore: number
	/** Draco-compressed geometry payload size in bytes. */
	geometryBytesAfterCompression: number
	/** Percentage reduction in geometry bytes (0-100). */
	reductionPercent: number
}

export interface OptimizationReport {
	/** Total scene payload size in bytes before optimization. */
	originalSize: number
	/** Total scene payload size in bytes after optimization. */
	optimizedSize: number
	/** Compression ratio */
	compressionRatio: number
	/** Applied optimizations */
	appliedOptimizations: string[]
	/** Optimization statistics */
	stats: OptimizationStats
	/** Draco geometry-compression metrics, if `compressGeometry` was applied. */
	draco?: DracoCompressionReport
}
