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

import { WebGLRenderer } from 'three'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader'

import eventSystem from '../event-system'

function createGltfLoader() {
	const dracoLoader = new DRACOLoader()
	dracoLoader.setDecoderPath('/draco/')

	const ktxLoader = new KTX2Loader()
	ktxLoader.setTranscoderPath('/draco/')

	const gltfLoader = new GLTFLoader()
		.setDRACOLoader(dracoLoader)
		.setKTX2Loader(ktxLoader.detectSupport(new WebGLRenderer()))
		.setMeshoptDecoder(MeshoptDecoder)

	gltfLoader.manager.onError = (url) => {
		eventSystem.emit('load-error', `Failed to load file ${url}`)
	}

	return gltfLoader
}

export default createGltfLoader
