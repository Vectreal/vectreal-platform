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

import { GLTF } from '@gltf-transform/core'

export type ModifiedTextureResources = {
	images: GLTF.IImage[]
	textures: GLTF.ITexture[]
}

/**
 * Options for exporting 3D models.
 *
 * @property textureFormats - Mapping of texture image names to desired export formats (MIME types).
 */
export interface ExportOptions {
	modifiedTextureResources?: ModifiedTextureResources
}

export interface ExportModelOptions extends ExportOptions {
	format?: 'glb' | 'gltf'
}

export interface ExportProgress {
	/** Current operation name */
	operation: string
	/** Progress percentage (0-100) */
	progress: number
	/** Additional details */
	details?: string
}

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

export type ExportResult = GLBExportResult | GLTFExportResult
