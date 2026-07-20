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

import type { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

let dracoLoaderPromise: Promise<DRACOLoader> | null = null
let dracoLoaderDecoderPath: string | null = null

/**
 * Returns a memoized `THREE.DRACOLoader` instance for use with
 * `GLTFLoader.setDRACOLoader()`. Shared across calls so the decoder is only
 * spun up once regardless of how many GLTFLoader parses happen.
 */
export async function getThreeDracoLoader(
	decoderPath: string
): Promise<DRACOLoader> {
	if (dracoLoaderPromise && dracoLoaderDecoderPath === decoderPath) {
		return dracoLoaderPromise
	}

	dracoLoaderDecoderPath = decoderPath
	dracoLoaderPromise = import('three/examples/jsm/loaders/DRACOLoader.js').then(
		({ DRACOLoader }) => {
			const loader = new DRACOLoader()
			loader.setDecoderPath(decoderPath)
			return loader
		}
	)

	return dracoLoaderPromise
}
