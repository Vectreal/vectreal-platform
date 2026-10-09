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
 * The optimization steps that are nothing but a list of glTF-Transform
 * transforms, which ModelOptimizer runs on a copy and commits.
 */

import { Transform } from '@gltf-transform/core'
import {
	dedup,
	DedupOptions as GltfDedupOptions,
	normals,
	NormalsOptions as GltfNormalsOptions,
	quantize,
	QuantizeOptions as GltfQuantizeOptions,
	simplify,
	weld
} from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'

import {
	DedupOptions,
	NormalsOptions,
	QuantizeOptions,
	SimplifyOptions
} from './types'

export interface TransformPass<Options> {
	/** What the applied-steps list records it as. */
	name: string
	started: string
	finished: string
	transforms: (options: Options) => Transform[]
}

export const simplifyPass: TransformPass<SimplifyOptions> = {
	name: 'simplification',
	started: 'Applying mesh simplification',
	finished: 'Mesh simplification complete',
	transforms: ({ ratio = 0.5, error = 0.001 }) => [
		weld(),
		simplify({ ratio, simplifier: MeshoptSimplifier, error })
	]
}

export const dedupPass: TransformPass<DedupOptions> = {
	name: 'deduplication',
	started: 'Applying deduplication',
	finished: 'Deduplication complete',
	transforms: (options) => [dedup(options as GltfDedupOptions)]
}

export const quantizePass: TransformPass<QuantizeOptions> = {
	name: 'quantization',
	started: 'Applying quantization',
	finished: 'Quantization complete',
	transforms: (options) => [quantize(options as GltfQuantizeOptions)]
}

export const normalsPass: TransformPass<NormalsOptions> = {
	name: 'normals optimization',
	started: 'Optimizing normals',
	finished: 'Normals optimization complete',
	transforms: (options) => [normals(options as GltfNormalsOptions)]
}
