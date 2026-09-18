import { getSerializedAssetByteSize } from '@vctrl/core'
import {
	referenceIn,
	resolutionKey,
	selectionKey
} from '@vctrl/core/model-loader'

import type { ServerSceneData } from '../types'

type ReferencedBytes = {
	sourcePackageBytes: number
	textureBytes: number
}

/**
 * TWO FRAMES, ONE RULE. The frames differ in how their keys are spelled; what a
 * reference *means* is the same question in both, and it has an owner.
 *
 * A dropped selection is keyed by where each file sat in the folder the visitor
 * dropped. A saved scene is keyed by the name each asset was stored under,
 * which is now the same folder URI the glTF writes. So both can be handed to
 * `referenceIn`, and the figure that gates a save then describes the file that
 * will actually render.
 *
 * It was two rules until this round, and they disagreed four ways: this one was
 * case-sensitive and split on `/` alone where the loader lower-cases and folds
 * `\\`, it had no notion of depth where the loader prefers the shallowest match,
 * and it answered a reference the loader refuses as a tie. Its own two passes
 * were not the "whole name first, then the basename" they claimed either, since
 * `buildAssetLookupKeys` puts the basename *in* the first pass's set - so a
 * bare `diffuse.png` still took whichever of `body/` and `wheels/` the database
 * happened to return first, and the same scene reported a 50x different size
 * depending on row order.
 */
const serverAssetSizes = (data: ServerSceneData) => {
	/*
	  KEYED BY THE OWNER'S RULE, WHICH IS THE WHOLE POINT. The loader keys this
	  same scene by `selectionKey`, so keying it any other way here makes two
	  maps that disagree about which names are the same name - and a collision
	  then resolves at opposite ends of each, the gate taking the first candidate
	  and the loader's `Map` keeping the last. `tex\\wood.png` beside
	  `tex/wood.png` billed one file while the other rendered, and which one
	  depended on the order the database returned the rows.

	  Not `normalizeAssetUri`, which also percent-decodes: a stored name is
	  already decoded and `referenceIn` decodes the reference, so decoding here
	  too put the two ends one step apart and a genuine `wood%20grain.png`
	  weighed nothing.
	*/
	const stored = new Map<string, number>()
	for (const asset of Object.values(data.assetData || {})) {
		stored.set(
			resolutionKey(asset.fileName),
			getSerializedAssetByteSize(asset.data)
		)
	}

	/*
	  NO MODEL PATH, BECAUSE THERE IS NO FOLDER TO RESOLVE AGAINST. A saved
	  scene's glTF is named by `sceneGltfFileName`, which replaces every
	  separator - so the name can never contain one, the scope is always `null`
	  and the directory always empty. Passing it read as coupling that guarded
	  something; it could not change an answer for any input.
	*/
	return (uri: string) => referenceIn(stored, uri) ?? 0
}

/** The dropped frame: what a reference weighs, resolved as the loader resolves it. */
const droppedAssetSizes = (gltfFile: File, assetFiles: File[]) => {
	const selection = new Map<string, number>()
	for (const file of assetFiles) selection.set(selectionKey(file), file.size)

	const modelPath = selectionKey(gltfFile)

	/*
	  A reference the loader will refuse weighs nothing here, deliberately. The
	  alternative is a figure counting one file twice, which is the shape of
	  every other defect this changeset closed.
	*/
	return (uri: string) => referenceIn(selection, uri, modelPath) ?? 0
}

const collectReferencedUris = (gltfJson: unknown) => {
	const bufferUris = new Set<string>()
	const imageUris = new Set<string>()
	const document = gltfJson as {
		images?: Array<{ uri?: string }>
		buffers?: Array<{ uri?: string }>
	}

	const images = Array.isArray(document.images)
		? (document.images as Array<{ uri?: string }>)
		: []
	for (const image of images) {
		if (typeof image.uri === 'string' && !image.uri.startsWith('data:')) {
			imageUris.add(image.uri)
		}
	}

	const buffers = Array.isArray(document.buffers)
		? (document.buffers as Array<{ uri?: string }>)
		: []
	for (const buffer of buffers) {
		if (typeof buffer.uri === 'string' && !buffer.uri.startsWith('data:')) {
			bufferUris.add(buffer.uri)
		}
	}

	return { bufferUris, imageUris }
}

export async function calculateReferencedBytesFromFiles(
	gltfFile: File,
	assetFiles: File[]
): Promise<ReferencedBytes> {
	const gltfText = await gltfFile.text()
	let gltfJson: Record<string, unknown>

	try {
		gltfJson = JSON.parse(gltfText) as Record<string, unknown>
	} catch {
		return {
			sourcePackageBytes: gltfFile.size,
			textureBytes: 0
		}
	}

	const sizeOf = droppedAssetSizes(gltfFile, assetFiles)

	const { bufferUris, imageUris } = collectReferencedUris(gltfJson)

	const bufferBytes = Array.from(bufferUris).reduce(
		(total, uri) => total + sizeOf(uri),
		0
	)
	const textureBytes = Array.from(imageUris).reduce(
		(total, uri) => total + sizeOf(uri),
		0
	)

	return {
		sourcePackageBytes: gltfFile.size + bufferBytes + textureBytes,
		textureBytes
	}
}

export function calculateReferencedBytesFromServerScene(
	data: ServerSceneData
): ReferencedBytes {
	const gltfJson = data.gltfJson
	if (!gltfJson) {
		// A published GLB is one opaque package: nothing is referenced by URI, so
		// there is nothing to attribute to buffers or textures.
		return { sourcePackageBytes: 0, textureBytes: 0 }
	}

	const sizeOf = serverAssetSizes(data)

	const gltfSize = new TextEncoder().encode(JSON.stringify(gltfJson)).byteLength
	const { bufferUris, imageUris } = collectReferencedUris(gltfJson)

	const bufferBytes = Array.from(bufferUris).reduce(
		(total, uri) => total + sizeOf(uri),
		0
	)
	const textureBytes = Array.from(imageUris).reduce(
		(total, uri) => total + sizeOf(uri),
		0
	)

	return {
		sourcePackageBytes: gltfSize + bufferBytes + textureBytes,
		textureBytes
	}
}
