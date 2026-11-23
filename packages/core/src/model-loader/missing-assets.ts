/* vectreal-core | @vctrl/core
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

import { PropertyType } from '@gltf-transform/core'

import type { Document, JSONDocument } from '@gltf-transform/core'

/**
 * "The model names files that did not come with it", as a fact rather than a
 * sentence.
 *
 * WHY THIS IS NOT A STRING COMPARISON. The refusal has several producers - the
 * glTF loader here and two in `@vctrl/hooks` - and the consumers that have to
 * tell it apart from a parse failure matched prose to do it. They matched the
 * scene payload builder's wording, so the loader's own refusal was filed as
 * "this file would not parse" and a visitor who dropped a perfectly valid folder
 * was told to check it was a valid glTF. The copy that names the real problem
 * was written, shipped and unreachable, on both the local and the server path.
 *
 * One producer is currently unreachable: `scene-data-builder`'s throw happens
 * inside the optimizer ingest, which logs and swallows it. It carries the marker
 * anyway, because the next person to rethrow it should not have to know.
 *
 * The name survives being wrapped, which the message alone does not: the
 * loader's throw reaches the caller inside a `Failed to load model from File
 * object:` wrapper, so the marker has to be looked for down the cause chain.
 */
const MISSING_ASSETS = 'MissingAssetsError'

/**
 * The refusal, carrying the marker its consumers recognize it by and the
 * references that found no file.
 *
 * The references travel as data because the reader needs them: the sentence
 * that says "a texture is missing" without saying which one leaves the visitor
 * to guess, and the names were in hand here and only ever printed into a
 * message no surface shows.
 */
export function missingAssetsError(
	message: string,
	missingFiles: readonly string[] = []
): Error {
	const error = new Error(message) as Error & {
		missingFiles: readonly string[]
	}
	error.name = MISSING_ASSETS
	/* Once each: two images naming one file are one file to bring. */
	error.missingFiles = [...new Set(missingFiles)]
	return error
}

/** Whether this failure, or anything it was wrapped around, is that refusal. */
export function isMissingAssetsError(error: unknown): boolean {
	return missingAssetsIn(error) !== null
}

/**
 * The references the refusal found no file for, wherever in the cause chain
 * it sits. Empty when the failure is not that refusal, or its producer did not
 * say.
 */
export function missingFilesOf(error: unknown): readonly string[] {
	return missingAssetsIn(error)?.missingFiles ?? []
}

function missingAssetsIn(
	error: unknown
): (Error & { missingFiles?: readonly string[] }) | null {
	let current = error

	/*
	  Bounded because this is exported. Nothing in this repo builds a cyclic
	  `cause` - every wrapper is a fresh `Error` - but a caller can, and an
	  unbounded walk hangs rather than answering.
	*/
	for (let hop = 0; hop < 16; hop += 1) {
		if (!(current instanceof Error)) return null
		if (current.name === MISSING_ASSETS) return current
		current = current.cause
	}

	return null
}

/**
 * Points each texture at an image that arrived, where it names two.
 *
 * `EXT_texture_webp`, `EXT_texture_avif` and `KHR_texture_basisu` give a
 * texture a second image, which the reader prefers over `source`. When that
 * one did not come and the fallback did, the reader would pick the missing one
 * and the surface would go grey with a usable picture in hand; so the
 * extension comes off and the texture reads its fallback.
 *
 * Run on the JSON before it is read, by both readers of a dropped glTF.
 */
export function preferArrivedImages({ json, resources }: JSONDocument): void {
	const images = json.images ?? []
	const arrived = (index: unknown): boolean => {
		if (typeof index !== 'number') return false
		const image = images[index]
		if (!image) return false
		if (typeof image.bufferView === 'number') return true
		if (typeof image.uri !== 'string') return false
		return image.uri.startsWith('data:') || Boolean(resources[image.uri])
	}

	for (const texture of json.textures ?? []) {
		if (!texture.extensions || !arrived(texture.source)) continue

		for (const [name, extension] of Object.entries(texture.extensions)) {
			const source = (extension as { source?: unknown }).source
			if (source !== undefined && !arrived(source)) {
				delete texture.extensions[name]
			}
		}
	}
}

/**
 * Takes off every texture whose image never arrived, and says which ones a
 * surface lost.
 *
 * A glTF that brought its geometry but not its pictures loads the way an OBJ
 * or an FBX without its images already does: correct but grey, each material
 * keeping its own color. The reader leaves such a texture holding no image,
 * and the exporter that turns the document into a GLB has nothing to write for
 * it, so the texture goes rather than the load. Disposing it also unhooks it
 * from every material slot that pointed at it.
 *
 * Only a texture something used is named: an image nothing points at, or a
 * fallback the texture did not need, changes no surface, and naming it would
 * say a surface is plain when it is not.
 *
 * Both readers of a dropped glTF call this - the loader that puts it on screen
 * and the optimizer that ingests it - so the scene on screen and the one that
 * gets optimized and saved are the same scene.
 *
 * @returns the URIs of the used textures it took off, as the glTF wrote them.
 */
export function dropTexturesWithoutImage(document: Document): string[] {
	const lost: string[] = []

	for (const texture of document.getRoot().listTextures()) {
		if (texture.getImage()) continue

		const used = texture
			.listParents()
			.some((parent) => parent.propertyType !== PropertyType.ROOT)
		if (used && texture.getURI()) lost.push(texture.getURI())
		texture.dispose()
	}

	return lost
}
