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

import { EXTMeshoptCompression } from '@gltf-transform/extensions'

import type { Document, WebIO } from '@gltf-transform/core'

/**
 * The meshopt decoder, ready to use. It is WebAssembly embedded in the module,
 * so unlike Draco there is nothing to fetch and it runs in Node as well.
 */
export async function loadMeshoptDecoder() {
	const { MeshoptDecoder } = await import('meshoptimizer/decoder')
	await MeshoptDecoder.ready
	return MeshoptDecoder
}

export async function loadMeshoptEncoder() {
	const { MeshoptEncoder } = await import('meshoptimizer/encoder')
	await MeshoptEncoder.ready
	return MeshoptEncoder
}

/** Lets `readBinary`/`readJSON` decode `EXT_meshopt_compression` buffers. */
export async function registerMeshoptDecoder(io: WebIO): Promise<void> {
	io.registerDependencies({ 'meshopt.decoder': await loadMeshoptDecoder() })
}

/**
 * Removes a decoded `EXT_meshopt_compression` extension, for the reason
 * `stripDecodedDracoExtension` removes Draco's: the reader leaves it attached
 * after decoding, and writing the document again would then need an encoder.
 */
export function stripDecodedMeshoptExtension(document: Document): void {
	document
		.getRoot()
		.listExtensionsUsed()
		.find((ext) => ext instanceof EXTMeshoptCompression)
		?.dispose()
}
