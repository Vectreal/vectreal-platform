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

import { Document, WebIO } from '@gltf-transform/core'
import {
	cloneDocument,
	draco,
	DracoOptions as GltfDracoOptions,
	inspect
} from '@gltf-transform/functions'

import { GeometryCodecs } from './geometry-codecs'
import {
	calculateDracoCompressedGeometrySize,
	calculateMeshSize,
	readGlbJsonChunk
} from './report-helpers'
import { DracoCompressionReport, DracoOptions } from './types'

type ProgressEmitter = (operation: string, progress: number) => void

export interface DracoEncoding {
	report: DracoCompressionReport
	workingDoc: Document
}

/**
 * Draco-encodes a clone of `document` and measures the result.
 *
 * The encode is the expensive half of every Draco path, so it happens here
 * exactly once and both callers take what they need: `measureDracoCompression`
 * keeps only the numbers, `compressGeometry` also adopts the document.
 */
export async function encodeDracoCopy(
	document: Document,
	options: DracoOptions,
	io: WebIO,
	codecs: GeometryCodecs,
	emitProgress: ProgressEmitter
): Promise<DracoEncoding> {
	emitProgress('Compressing geometry with Draco', 0)

	await codecs.registerDracoEncoder()

	const geometryBytesBefore = calculateMeshSize(inspect(document))
	const uncompressedGlbBytes = (await io.writeBinary(document)).byteLength

	emitProgress('Compressing geometry with Draco', 40)

	const workingDoc = cloneDocument(document)
	await workingDoc.transform(draco(options as GltfDracoOptions))
	const compressedGlb = await io.writeBinary(workingDoc)

	emitProgress('Compressing geometry with Draco', 90)

	const geometryBytesAfterCompression = calculateDracoCompressedGeometrySize(
		readGlbJsonChunk(compressedGlb)
	)
	const reductionPercent =
		geometryBytesBefore > 0
			? ((geometryBytesBefore - geometryBytesAfterCompression) /
					geometryBytesBefore) *
				100
			: 0

	return {
		workingDoc,
		report: {
			geometryBytesBefore,
			geometryBytesAfterCompression,
			reductionPercent,
			projectedGlbBytes: compressedGlb.byteLength,
			uncompressedGlbBytes,
			isWorthApplying: compressedGlb.byteLength < uncompressedGlbBytes
		}
	}
}
