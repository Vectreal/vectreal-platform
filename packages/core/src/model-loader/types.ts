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

import { MODEL_FORMAT_IDS, type ModelFormatId } from '../model-formats'

import type { Document } from '@gltf-transform/core'
import type { AnimationClip, Object3D } from 'three'

/**
 * The format ids, as a value and as a type, derived from the owner.
 *
 * This was an enum restating the three extensions, which made it one of the
 * nine independent statements of the accepted-format set - and the one most
 * likely to be trusted, since an enum reads as a definition. It is now a
 * projection of `MODEL_FORMATS`, so a format added there appears here with no
 * edit and none can be added here that the loader cannot dispatch.
 *
 * Kept as a named export rather than replaced by `ModelFormatId` because it is
 * `@vctrl/core`'s published surface; `ModelFormatId` is the same union.
 */
export const ModelFileTypes = Object.fromEntries(
	MODEL_FORMAT_IDS.map((id) => [id, id])
) as { readonly [K in ModelFormatId]: K }

export type ModelFileTypes = ModelFormatId

export interface ModelLoadResult {
	/** The loaded model data */
	data: Document
	/** Model file type */
	type: ModelFileTypes
	/** File size in bytes */
	size: number
	/** File name */
	name: string
	/** Load duration in milliseconds */
	loadTime: number
	/**
	 * The GLB the source was converted into, for a format read through a
	 * three.js loader. Absent for the glTF family, whose own bytes are already
	 * the GLB to ingest.
	 *
	 * It exists because the file the visitor picked is not glTF in that case, so
	 * a caller that re-reads the file to hand it to the optimizer hands it an
	 * STL and gets a magic-bytes error on a model that is already on screen.
	 */
	glbBytes?: Uint8Array
}

export interface ThreeJSModelResult extends Omit<ModelLoadResult, 'data'> {
	/** The loaded Three.js scene */
	scene: Object3D
	/** Animation clips carried by the model. Empty when it has none. */
	animations: AnimationClip[]
	/** Original document data */
	document: Document
}
