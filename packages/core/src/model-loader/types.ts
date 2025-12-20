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

import type { Document } from '@gltf-transform/core'
import type { Object3D } from 'three'

export enum ModelFileTypes {
	gltf = 'gltf',
	glb = 'glb',
	usdz = 'usdz'
}

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
}

export interface ThreeJSModelResult extends Omit<ModelLoadResult, 'data'> {
	/** The loaded Three.js scene */
	scene: Object3D
	/** Original document data */
	document: Document
}
