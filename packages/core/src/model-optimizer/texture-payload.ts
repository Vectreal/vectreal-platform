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
 * A document's textures by index, for callers that read or replace a
 * texture's bytes themselves rather than through a compression pass.
 */

import { Document, Texture } from '@gltf-transform/core'

import {
	resolveTextureCanonicalFileName,
	syncTextureIdentity
} from './texture-naming'
import { TextureBinaryPayload, TextureDescriptor } from './types'

const FALLBACK_MIME_TYPE = 'application/octet-stream'

function textureAt(document: Document, index: number): Texture {
	const texture = document.getRoot().listTextures()[index]
	if (!texture) {
		throw new Error(`Texture not found for index ${index}`)
	}
	return texture
}

export function listTextureDescriptors(
	document: Document
): TextureDescriptor[] {
	return document
		.getRoot()
		.listTextures()
		.map((texture, index) => {
			const fileName = resolveTextureCanonicalFileName(document, texture, index)
			return {
				index,
				fileName,
				name: fileName,
				mimeType: texture.getMimeType() || FALLBACK_MIME_TYPE,
				byteLength: texture.getImage()?.byteLength ?? 0
			}
		})
}

export function getTexturePayload(
	document: Document,
	index: number
): TextureBinaryPayload {
	const texture = textureAt(document, index)
	const image = texture.getImage()
	if (!image || image.byteLength === 0) {
		throw new Error(`Texture at index ${index} has no image payload`)
	}

	const fileName = resolveTextureCanonicalFileName(document, texture, index)
	return {
		index,
		fileName,
		name: fileName,
		mimeType: texture.getMimeType() || FALLBACK_MIME_TYPE,
		image
	}
}

export function replaceTexturePayload(
	document: Document,
	index: number,
	image: Uint8Array,
	mimeType: string,
	fileName?: string
): void {
	const texture = textureAt(document, index)
	texture.setImage(image)
	texture.setMimeType(mimeType)
	syncTextureIdentity(document, texture, index, fileName)
}
