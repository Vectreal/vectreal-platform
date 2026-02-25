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

import type { BeforeAfterMetric, ServerOptions } from '../types'

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

export interface TextureCompressOptions {
	/** Maximum texture size */
	resize?: [number, number]
	/** Target texture format */
	targetFormat?: 'webp' | 'jpeg' | 'png'
	/** Compression quality (0-100) */
	quality?: number

	/** Request timeout in milliseconds for per-texture server calls */
	requestTimeoutMs?: number
	/** Maximum texture payload bytes to allow for upload */
	maxTextureUploadBytes?: number
	/** Maximum retry attempts for transient server errors */
	maxRetries?: number

	/** Whether to use server endpoint (if available) */
	serverOptions?: ServerOptions
}

export interface TextureDescriptor {
	index: number
	name: string
	mimeType: string
	byteLength: number
}

export interface TextureBinaryPayload {
	index: number
	name: string
	mimeType: string
	image: Uint8Array
}

export interface OptimizationReport {
	/** File size before optimization */
	originalSize: number
	/** File size after optimization */
	optimizedSize: number
	/** Compression ratio */
	compressionRatio: number
	/** Applied optimizations */
	appliedOptimizations: string[]
	/** Optimization statistics */
	stats: {
		vertices: BeforeAfterMetric
		triangles: BeforeAfterMetric
		materials: BeforeAfterMetric
		textures: BeforeAfterMetric
		texturesCount: BeforeAfterMetric
		textureResolutions: {
			before: string[]
			after: string[]
		}
		meshes: BeforeAfterMetric
		nodes: BeforeAfterMetric
	}
}
