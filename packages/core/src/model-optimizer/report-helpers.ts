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

/**
 * Pure helpers for building the OptimizationReport from glTF-Transform InspectReport data.
 */

import { JSONDocument } from '@gltf-transform/core'
import { InspectReport } from '@gltf-transform/functions'

import { DracoCompressionReport, OptimizationReport } from './types'

const GLB_HEADER_BYTES = 12
const GLB_CHUNK_HEADER_BYTES = 8
/** 'glTF' as a little-endian uint32. */
const GLB_MAGIC = 0x46546c67
/** 'JSON' as a little-endian uint32. */
const GLB_CHUNK_TYPE_JSON = 0x4e4f534a

export function calculateCounts(inspectReport: InspectReport) {
	let vertices = 0
	let primitives = 0

	if (inspectReport.meshes?.properties) {
		inspectReport.meshes.properties.forEach((mesh) => {
			vertices += mesh.vertices || 0
			primitives += mesh.glPrimitives || 0
		})
	}

	return { vertices, primitives }
}

export function calculateTextureSize(inspectReport: InspectReport): number {
	let totalSize = 0
	if (inspectReport.textures?.properties) {
		inspectReport.textures.properties.forEach((texture) => {
			totalSize += texture.size || texture.gpuSize || 0
		})
	}
	return totalSize
}

export function calculateTextureCount(inspectReport: InspectReport): number {
	return inspectReport.textures?.properties?.length ?? 0
}

export function calculateTextureResolutions(
	inspectReport: InspectReport
): string[] {
	const resolutions = new Set<string>()
	if (inspectReport.textures?.properties) {
		inspectReport.textures.properties.forEach((texture) => {
			const entry = texture as unknown as {
				width?: number
				height?: number
				dimensions?: [number, number]
			}

			if (typeof entry.width === 'number' && typeof entry.height === 'number') {
				resolutions.add(`${entry.width}x${entry.height}`)
				return
			}

			if (
				Array.isArray(entry.dimensions) &&
				entry.dimensions.length === 2 &&
				typeof entry.dimensions[0] === 'number' &&
				typeof entry.dimensions[1] === 'number'
			) {
				resolutions.add(`${entry.dimensions[0]}x${entry.dimensions[1]}`)
			}
		})
	}
	return Array.from(resolutions)
}

export function calculateMeshSize(inspectReport: InspectReport): number {
	let totalSize = 0
	if (inspectReport.meshes?.properties) {
		inspectReport.meshes.properties.forEach((mesh) => {
			totalSize += mesh.size || 0
		})
	}
	return totalSize
}

/**
 * Extracts the JSON chunk of a GLB as a parsed glTF document.
 *
 * Lets callers read metadata out of bytes they already wrote (compressed
 * bufferView sizes, extension declarations) without paying for a second
 * serialization pass. GLB layout: a 12-byte header, then length-prefixed
 * chunks; chunk 0 is always JSON.
 */
export function readGlbJsonChunk(glb: Uint8Array): JSONDocument['json'] {
	const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength)

	if (view.getUint32(0, true) !== GLB_MAGIC) {
		throw new Error("Not a GLB: missing 'glTF' magic bytes")
	}

	const chunkLength = view.getUint32(12, true)
	if (view.getUint32(16, true) !== GLB_CHUNK_TYPE_JSON) {
		throw new Error('Malformed GLB: first chunk is not JSON')
	}

	const chunkStart = GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES
	const chunkText = new TextDecoder().decode(
		glb.subarray(chunkStart, chunkStart + chunkLength)
	)

	return JSON.parse(chunkText) as JSONDocument['json']
}

/**
 * Sums the byte length of Draco-compressed geometry bufferViews in written
 * glTF JSON. `inspect()` can't see this — Draco compression only happens when
 * the document is serialized, so the compressed size has to be read back out
 * of the written JSON's `KHR_draco_mesh_compression` bufferView references
 * instead.
 */
export function calculateDracoCompressedGeometrySize(
	json: JSONDocument['json']
): number {
	const bufferViewIndices = new Set<number>()

	for (const mesh of json.meshes ?? []) {
		for (const primitive of mesh.primitives ?? []) {
			const dracoExtension = primitive.extensions?.[
				'KHR_draco_mesh_compression'
			] as { bufferView?: number } | undefined
			if (typeof dracoExtension?.bufferView === 'number') {
				bufferViewIndices.add(dracoExtension.bufferView)
			}
		}
	}

	let totalSize = 0
	for (const index of bufferViewIndices) {
		totalSize += json.bufferViews?.[index]?.byteLength ?? 0
	}
	return totalSize
}

export function buildOptimizationReport(
	originalSize: number,
	currentSize: number,
	originalReport: InspectReport | null,
	currentInspectReport: InspectReport,
	appliedOptimizations: string[],
	dracoReport?: DracoCompressionReport
): OptimizationReport {
	const originalCounts = originalReport
		? calculateCounts(originalReport)
		: { vertices: 0, primitives: 0 }
	const currentCounts = calculateCounts(currentInspectReport)

	return {
		originalSize,
		optimizedSize: currentSize,
		compressionRatio: originalSize / currentSize,
		appliedOptimizations: [...appliedOptimizations],
		...(dracoReport ? { draco: dracoReport } : {}),
		stats: {
			vertices: {
				before: originalCounts.vertices,
				after: currentCounts.vertices
			},
			triangles: {
				before: originalCounts.primitives,
				after: currentCounts.primitives
			},
			materials: {
				before: originalReport?.materials?.properties?.length ?? 0,
				after: currentInspectReport.materials?.properties?.length ?? 0
			},
			textures: {
				before: originalReport ? calculateTextureSize(originalReport) : 0,
				after: calculateTextureSize(currentInspectReport)
			},
			texturesCount: {
				before: originalReport ? calculateTextureCount(originalReport) : 0,
				after: calculateTextureCount(currentInspectReport)
			},
			textureResolutions: {
				before: originalReport
					? calculateTextureResolutions(originalReport)
					: [],
				after: calculateTextureResolutions(currentInspectReport)
			},
			meshes: {
				before: originalReport ? calculateMeshSize(originalReport) : 0,
				after: calculateMeshSize(currentInspectReport)
			},
			nodes: {
				before: 0, // Node count not available in inspect report
				after: 0
			}
		}
	}
}
