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
 * Resolving canonical texture filenames. No I/O, so everything here is safe to
 * call in any environment; only the `sync*` functions write, and only to the
 * textures they are given.
 */

import { Document, ImageUtils, Material, Texture } from '@gltf-transform/core'

// ---------------------------------------------------------------------------
// MIME / format converters
// ---------------------------------------------------------------------------

/**
 * A MIME type as glTF expects it. One taken from a URI can arrive as
 * `image/PNG`, `image/JPG` or `image/png?v=2`: types are case-insensitive,
 * nothing after a `?`, `#` or `;` names a format, and `jpg` is spelled
 * `jpeg` in a type.
 */
export const normalizeMimeType = (mimeType: string): string => {
	const normalized = mimeType.toLowerCase().split(/[?#;]/)[0].trim()
	return normalized === 'image/jpg' ? 'image/jpeg' : normalized
}

export const mimeTypeToExtension = (mimeType: string): string | null => {
	switch (normalizeMimeType(mimeType)) {
		case 'image/webp':
			return 'webp'
		case 'image/jpeg':
			return 'jpg'
		case 'image/png':
			return 'png'
		case 'image/ktx2':
			return 'ktx2'
		case 'image/avif':
			return 'avif'
		default:
			return null
	}
}

// ---------------------------------------------------------------------------
// URI / filename helpers
// ---------------------------------------------------------------------------

export const replaceUriExtension = (uri: string, extension: string): string => {
	if (!uri || uri.startsWith('data:')) {
		return uri
	}

	const queryIndex = uri.indexOf('?')
	const hashIndex = uri.indexOf('#')
	const suffixStart = [queryIndex, hashIndex]
		.filter((index) => index >= 0)
		.reduce((min, index) => Math.min(min, index), Number.POSITIVE_INFINITY)
	const hasSuffix = Number.isFinite(suffixStart)
	const base = hasSuffix ? uri.slice(0, suffixStart) : uri
	const suffix = hasSuffix ? uri.slice(suffixStart) : ''

	const lastSlash = base.lastIndexOf('/')
	const lastDot = base.lastIndexOf('.')
	const hasExtension = lastDot > lastSlash
	const nextBase = hasExtension
		? `${base.slice(0, lastDot)}.${extension}`
		: `${base}.${extension}`

	return `${nextBase}${suffix}`
}

export const buildTextureFallbackFileName = (
	index: number,
	mimeType: string | null
): string => {
	const extension = mimeType ? mimeTypeToExtension(mimeType) : null
	return extension ? `texture-${index}.${extension}` : `texture-${index}`
}

export const extractFileNameSegment = (value: string): string => {
	const withoutQuery = value.split('?')[0] || value
	const withoutHash = withoutQuery.split('#')[0] || withoutQuery
	const normalized = withoutHash.replace(/\\/g, '/').trim()
	return normalized.split('/').pop() || normalized
}

const GENERIC_TEXTURE_FILE_NAME_PATTERN =
	/^(?:text{1,2}ure|image|img)[-_ ]?\d+(?:\.[a-z0-9]+)?$/i

export const isGenericTextureFileName = (value: string): boolean => {
	const trimmed = value.trim()
	if (trimmed.length === 0) {
		return false
	}

	const fileName = extractFileNameSegment(trimmed)
	return GENERIC_TEXTURE_FILE_NAME_PATTERN.test(fileName)
}

export const sanitizeName = (name: string): string =>
	name
		.replace(/[^a-zA-Z0-9_-]/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '')

// ---------------------------------------------------------------------------
// Material-slot resolution
// ---------------------------------------------------------------------------

export const MATERIAL_TEXTURE_SLOTS: Array<{
	slot: string
	get: (mat: Material) => Texture | null
}> = [
	{ slot: 'baseColor', get: (m) => m.getBaseColorTexture() },
	{ slot: 'metallicRoughness', get: (m) => m.getMetallicRoughnessTexture() },
	{ slot: 'normal', get: (m) => m.getNormalTexture() },
	{ slot: 'occlusion', get: (m) => m.getOcclusionTexture() },
	{ slot: 'emissive', get: (m) => m.getEmissiveTexture() }
]

export const resolveTextureByMaterialSlot = (
	document: Document,
	texture: Texture
): { materialName: string; slotName: string } | null => {
	for (const material of document.getRoot().listMaterials()) {
		for (const { slot, get } of MATERIAL_TEXTURE_SLOTS) {
			if (get(material) === texture) {
				const rawName = material.getName()?.trim()
				const materialName = rawName ? sanitizeName(rawName) : 'Material'
				return { materialName, slotName: slot }
			}
		}
	}
	return null
}

// ---------------------------------------------------------------------------
// Canonical names
// ---------------------------------------------------------------------------

// Typed as a string, but a glTF image's `"name": null` reads back as null.
const storedName = (texture: Texture): string => texture.getName()?.trim() ?? ''

/**
 * The file name a texture is known by: its own stable URI or name, else its
 * material slot (`Wood_Planks_baseColor.png`), else its position
 * (`texture-2.png`), with the extension its MIME type calls for.
 */
export const resolveTextureCanonicalFileName = (
	document: Document,
	texture: Texture,
	index: number
): string => {
	const currentUri = texture.getURI().trim()
	const currentName = storedName(texture)
	const stableUri =
		currentUri &&
		!currentUri.startsWith('data:') &&
		!isGenericTextureFileName(currentUri)
			? currentUri
			: ''
	const stableName =
		currentName && !isGenericTextureFileName(currentName) ? currentName : ''
	const extension = mimeTypeToExtension(texture.getMimeType())

	if (stableUri || stableName) {
		const baseFileName = extractFileNameSegment(stableUri || stableName)
		return extension
			? replaceUriExtension(baseFileName, extension)
			: baseFileName
	}

	const slot = resolveTextureByMaterialSlot(document, texture)
	if (slot) {
		const slotFileName = `${slot.materialName}_${slot.slotName}`
		return extension ? `${slotFileName}.${extension}` : slotFileName
	}

	return buildTextureFallbackFileName(index, texture.getMimeType())
}

/**
 * The type a texture's bytes are: what the bytes say when gltf-transform
 * recognizes them, else the image type the texture has stored, else none.
 * PNG and JPEG are always recognized; WebP, AVIF and KTX2 once an I/O has
 * registered their extensions, as every document the optimizer holds has.
 * Neither a file name nor a stored `application/octet-stream` says what the
 * bytes are. The URI is cleared to read what is stored, because
 * `getMimeType` falls back to the URI's extension. Putting the URI back
 * overwrites the stored type, so the caller must store the type returned.
 */
const resolveImageMimeType = (texture: Texture): string => {
	const image = texture.getImage()
	const detected = image ? ImageUtils.getMimeType(image) : null
	if (detected) return detected

	const uri = texture.getURI()
	const stored = normalizeMimeType(texture.setURI('').getMimeType())
	texture.setURI(uri)
	return stored.startsWith('image/') ? stored : ''
}

/**
 * Writes a texture's canonical file name to its URI and name, and settles its
 * MIME type first, so the name's extension follows that type. A stable
 * `fileName` is written first, so the canonical name is resolved from it.
 *
 * gltf-transform's `setURI` also sets the MIME type from whatever follows the
 * last dot, the whole name when there is none, so every write puts the
 * settled type back. With none known, none is stored and the getter reads the
 * type off the new name. That is right for a name with an extension; one
 * without reads as a made-up `image/<name>`, which is left as it is because
 * nothing says what such bytes are. Written unconditionally, so what is
 * stored is always exactly what `resolveTextureCanonicalFileName` reports.
 */
export const syncTextureIdentity = (
	document: Document,
	texture: Texture,
	index: number,
	fileName?: string
): void => {
	const mimeType = resolveImageMimeType(texture)
	const writeFileName = (name: string) =>
		texture.setURI(name).setMimeType(mimeType).setName(name)

	// Before anything reads it: resolving overwrote the stored type.
	texture.setMimeType(mimeType)
	const preferredFileName = fileName?.trim()
	if (preferredFileName && !isGenericTextureFileName(preferredFileName)) {
		writeFileName(extractFileNameSegment(preferredFileName))
	}

	writeFileName(resolveTextureCanonicalFileName(document, texture, index))
}

/** Gives every texture of `document` its canonical file name. */
export const syncTextureIdentities = (document: Document): void => {
	document
		.getRoot()
		.listTextures()
		.forEach((texture, index) => syncTextureIdentity(document, texture, index))
}
