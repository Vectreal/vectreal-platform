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

import { KHRDracoMeshCompression } from '@gltf-transform/extensions'

import type { Document } from '@gltf-transform/core'

/**
 * Removes a decoded `KHR_draco_mesh_compression` extension instance from a
 * document, if present.
 *
 * glTF-Transform's reader attaches this extension to the Document whenever
 * the source file lists it in `extensionsUsed` — permanently, regardless of
 * whether `preread()` already decoded the geometry into plain accessors.
 * Left in place, any later `io.writeBinary`/`writeJSON` on that document
 * will hit the extension's `prewrite()` hook, which unconditionally throws
 * unless a `draco3d.encoder` module is registered — even when there's
 * nothing left to compress.
 *
 * Call this right after reading a document so downstream writes (viewer
 * round-trips, unmodified re-saves, exports) don't need an encoder just to
 * handle content that happened to arrive Draco-compressed. Compression is
 * opt-in elsewhere (`ModelOptimizer.compressGeometry`,
 * `ModelExporter.exportDocumentGLBDraco`), which attach their own fresh
 * extension instance via the `draco()` transform.
 */
export function stripDecodedDracoExtension(document: Document): void {
	const extension = document
		.getRoot()
		.listExtensionsUsed()
		.find((ext) => ext instanceof KHRDracoMeshCompression)

	extension?.dispose()
}
