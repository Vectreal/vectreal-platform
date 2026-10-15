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

/**
 * `_initDecoder` is the private step behind `preload()` that downloads the
 * decoder. It is the only handle on that download's outcome.
 */
type DecoderLoader = DRACOLoader & { _initDecoder(): Promise<unknown> }

interface MemoizedLoader {
	decoderPath: string
	loader: Promise<DRACOLoader>
}

let memoized: MemoizedLoader | null = null

/**
 * Returns a memoized `THREE.DRACOLoader` instance for use with
 * `GLTFLoader.setDRACOLoader()`. Shared across calls so the decoder is only
 * spun up once regardless of how many GLTFLoader parses happen.
 *
 * A loader keeps the promise of its decoder download, a rejection included,
 * so after one failed download it fails every model it is given. A loader
 * whose download fails is therefore dropped, and the next caller gets a new one.
 */
export async function getThreeDracoLoader(
	decoderPath: string
): Promise<DRACOLoader> {
	if (memoized?.decoderPath === decoderPath) return memoized.loader

	const entry: MemoizedLoader = {
		decoderPath,
		loader: import('three/examples/jsm/loaders/DRACOLoader.js').then(
			({ DRACOLoader }) => {
				const loader = new DRACOLoader() as DecoderLoader
				loader.setDecoderPath(decoderPath)

				const initDecoder = loader._initDecoder.bind(loader)
				loader._initDecoder = () =>
					initDecoder().catch((error: unknown) => {
						if (memoized === entry) memoized = null
						throw error
					})

				return loader
			}
		)
	}
	memoized = entry

	return entry.loader
}

/**
 * Downloads and compiles the decoder ahead of the first model that needs it.
 * Unlike `preload()`, it reports a failed download to the caller.
 */
export async function prepareThreeDracoDecoder(
	decoderPath: string
): Promise<void> {
	const loader = (await getThreeDracoLoader(decoderPath)) as DecoderLoader
	await loader._initDecoder()
}
