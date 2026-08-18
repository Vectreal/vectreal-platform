/* vectreal-core | vctrl/hooks
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>. */

import { ModelFileTypes } from '@vctrl/core/model-loader'

import {
	LoadedModel,
	ModelSourceKind,
	ModelState,
	StructuredLoadError
} from './types'

/** Model formats the loader accepts. */
export const supportedFileTypes: ModelFileTypes[] = [
	ModelFileTypes.gltf,
	ModelFileTypes.glb,
	ModelFileTypes.usdz
]

/**
 * The four states a load can be in. Building them here rather than spreading
 * partial updates is what keeps `status`, `file` and `error` from drifting apart.
 */
export const emptyModelState: ModelState = {
	status: 'empty',
	file: null,
	error: null,
	source: null,
	progress: 0
}

export const loadingModelState = (
	source: ModelSourceKind,
	progress = 0
): ModelState => ({
	status: 'loading',
	file: null,
	error: null,
	source,
	progress
})

export const readyModelState = (
	source: ModelSourceKind,
	loaded: LoadedModel
): ModelState => ({
	status: 'ready',
	file: loaded.file,
	error: null,
	source,
	progress: 100,
	sceneId: loaded.sceneId,
	sceneData: loaded.sceneData
})

export const errorModelState = (
	source: ModelSourceKind,
	error: StructuredLoadError
): ModelState => ({
	status: 'error',
	file: null,
	error,
	source,
	progress: 0
})
