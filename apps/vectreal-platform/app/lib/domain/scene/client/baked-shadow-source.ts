import {
	PERSISTED_BAKE_FILENAME,
	toSerializedAssetBytes,
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
 * Resolves the persisted shadow bake from a scene's in-memory asset data into a
 * `BakedShadow` the viewer can render, with no extra network request: the density
 * PNG already rides in the aggregate's `assetData`, so this turns it into a data
 * URL the shadow plane consumes directly.
 *
 * Looks the bake up by its stable filename ({@link PERSISTED_BAKE_FILENAME})
 * rather than the asset-map key, because the key differs between load paths
 * (publisher vs preview) while the filename is invariant.
 */
export const resolveBakedShadowSource = (
	shadows: SceneSettings['shadows'] | undefined,
	assetData: SerializedSceneAssetDataMap | null | undefined
): BakedShadow | undefined => {
	if (!shadows || shadows.type !== 'accumulative' || !shadows.baked) {
		return undefined
	}
	if (!assetData) {
		return undefined
	}

	const entry = Object.values(assetData).find(
		(candidate) => candidate.fileName === PERSISTED_BAKE_FILENAME
	)
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
