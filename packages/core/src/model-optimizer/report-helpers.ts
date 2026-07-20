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
 * Sums the byte length of Draco-compressed geometry bufferViews in a written
 * JSONDocument. `inspect()` can't see this — Draco compression only happens
 * when the document is serialized, so the compressed size has to be read
 * back out of the written glTF JSON's `KHR_draco_mesh_compression` bufferView
 * references instead.
 */
export function calculateDracoCompressedGeometrySize(
	jsonDoc: JSONDocument
): number {
	const { json } = jsonDoc
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
