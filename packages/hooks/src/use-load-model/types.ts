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

import { Object3D } from 'three'

export enum ModelFileTypes {
	gltf = 'gltf',
	glb = 'glb',
	usdz = 'usdz'
}

export type InputFileOrDirectory = (File | FileSystemDirectoryHandle)[]

export interface ModelFile {
	model: Object3D
	type: ModelFileTypes
	name: string
}

// Updated State interface
export interface LoadData {
	file: ModelFile | null
	isFileLoading: boolean
	progress: number
	supportedFileTypes: ModelFileTypes[]
}

// Updated Action types
export type Action =
	| { type: 'set-file'; payload: ModelFile }
	| { type: 'set-file-loading'; payload: boolean }
	| { type: 'set-progress'; payload: number }
	| { type: 'reset-state' }

// Updated Event types
export type EventTypes =
	| 'multiple-models'
	| 'not-loaded-files'
	| 'load-start'
	| 'load-progress'
	| 'load-complete'
	| 'load-reset'
	| 'load-error'

// Updated event data types
export type EventData = {
	'multiple-models': File[]
	'not-loaded-files': File[]
	'load-start': null
	'load-progress': number
	'load-complete': LoadData['file']
	'load-reset': null
	'load-error': Error | unknown
}

// Updated EventHandler type
export type EventHandler<T extends EventTypes> = (data?: EventData[T]) => void
