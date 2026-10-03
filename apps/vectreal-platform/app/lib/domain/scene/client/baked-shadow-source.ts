import {
	PERSISTED_BAKE_FILENAME,
	toSerializedAssetBytes,
	type SceneAssetRefMap,
	type SceneSettings,
	type SerializedSceneAssetDataMap
} from '@vctrl/core'

import type { BakedShadow } from '@vctrl/viewer'

const bytesToBase64 = (bytes: Uint8Array): string => {
	let binary = ''
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i])
	}
	return btoa(binary)
}

/**
 * Resolves the persisted shadow bake into a `BakedShadow` the viewer can
 * render.
 *
 * A published scene references the bake by URL (`assetRefs`), and the viewer
 * loads it like any texture. A scene whose bake arrived as bytes - the editor
 * manifest, or one the publisher just captured - is turned into a data URL.
 *
 * Looks the bake up by its stable filename ({@link PERSISTED_BAKE_FILENAME})
 * rather than the asset-map key, because the key differs between load paths
 * (publisher vs preview) while the filename is invariant.
 */
export const resolveBakedShadowSource = (
	shadows: SceneSettings['shadows'] | undefined,
	assets: {
		assetData?: SerializedSceneAssetDataMap | null
		assetRefs?: SceneAssetRefMap | null
	}
): BakedShadow | undefined => {
	if (!shadows?.baked) {
		return undefined
	}

	const isBake = (candidate: { fileName: string }) =>
		candidate.fileName === PERSISTED_BAKE_FILENAME

	const ref = Object.values(assets.assetRefs ?? {}).find(isBake)
	if (ref) {
		return { url: ref.url, signature: shadows.baked.signature }
	}

	const entry = Object.values(assets.assetData ?? {}).find(isBake)
	if (!entry) {
		return undefined
	}

	// Server-serialized entries already carry base64; client-built ones carry a
	// byte array. Normalize to base64 for the data URL.
	const base64 =
		typeof entry.data === 'string'
			? entry.data
			: bytesToBase64(toSerializedAssetBytes(entry))

	return {
		url: `data:${entry.mimeType};base64,${base64}`,
		signature: shadows.baked.signature
	}
}
