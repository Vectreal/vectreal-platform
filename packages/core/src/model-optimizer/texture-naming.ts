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
 * call in any environment; only the `sync*` functions write, and only the
 * names they resolve onto the textures they are given.
 */

import { Document, Material, Texture } from '@gltf-transform/core'

// ---------------------------------------------------------------------------
// MIME / format converters
// ---------------------------------------------------------------------------

export const mimeTypeToExtension = (mimeType: string): string | null => {
	switch (mimeType.toLowerCase()) {
		case 'image/webp':
			return 'webp'
		case 'image/jpeg':
			return 'jpg'
		case 'image/png':
			return 'png'
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
	const currentName = texture.getName().trim()
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
 * Writes the canonical file name onto a texture's URI and name. A stable
 * `fileName` is adopted first, so it becomes the name the texture keeps.
 */
export const syncTextureIdentity = (
	document: Document,
	texture: Texture,
	index: number,
	fileName?: string
): void => {
	const currentName = texture.getName().trim()
	const currentUri = texture.getURI().trim()
	const preferredFileName = fileName?.trim()

	if (preferredFileName && !isGenericTextureFileName(preferredFileName)) {
		const preferredBaseName = extractFileNameSegment(preferredFileName)
		if (currentUri !== preferredBaseName) texture.setURI(preferredBaseName)
		if (currentName !== preferredBaseName) texture.setName(preferredBaseName)
	}

	const canonicalFileName = resolveTextureCanonicalFileName(
		document,
		texture,
		index
	)
	if (currentUri !== canonicalFileName) texture.setURI(canonicalFileName)
	if (currentName !== canonicalFileName) texture.setName(canonicalFileName)
}

/** Gives every texture of `document` its canonical file name. */
export const syncTextureIdentities = (document: Document): void => {
	document
		.getRoot()
		.listTextures()
		.forEach((texture, index) => syncTextureIdentity(document, texture, index))
}
