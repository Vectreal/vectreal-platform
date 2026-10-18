import {
	buildAssetLookupKeys,
	isValidBase64,
	normalizeCameraSettings,
	normalizeSceneInteractions,
	normalizeAssetUri
} from '@vctrl/core'
import { missingAssetsError } from '@vctrl/core/model-loader'

import type {
	SceneSettings,
	SerializedSceneAssetDataMap,
	ServerSceneData,
	ServerScenePayload
} from '@vctrl/core'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/*
  Every settings field, as a total record so that a field added to
  `SceneSettings` fails to compile here until it is listed. A hand-written list
  of five legacy names used to sit in this place, which made "dropped" the
  default for anything newer: a flat payload (a local draft is one) lost its
  hotspots, normalization, interactions, animation and presentation.
*/
const SCENE_SETTINGS_FIELDS = {
	animation: true,
	bounds: true,
	camera: true,
	interactions: true,
	controls: true,
	environment: true,
	shadows: true,
	normalization: true,
	hotspots: true,
	presentation: true
} as const satisfies Record<keyof SceneSettings, true>

/** A flat field wins over its nested twin; null and undefined defer to it. */
function toSceneSettings(payload: ServerScenePayload): SceneSettings {
	const settings: Record<string, unknown> = isRecord(payload.settings)
		? { ...payload.settings }
		: {}
	for (const field of Object.keys(SCENE_SETTINGS_FIELDS) as Array<
		keyof SceneSettings
	>) {
		const flat = payload[field]
		if (flat !== undefined && flat !== null) {
			settings[field] = flat
		}
	}

	const merged = settings as SceneSettings
	const camera = normalizeCameraSettings(merged.camera)

	return {
		...merged,
		camera,
		interactions: normalizeSceneInteractions(merged.interactions, { camera })
	}
}

function collectReferencedUris(gltfJson: unknown): Set<string> {
	const referencedUris = new Set<string>()
	const document = gltfJson as {
		images?: Array<{ uri?: string }>
		buffers?: Array<{ uri?: string }>
	}

	const images = Array.isArray(document.images)
		? (document.images as Array<{ uri?: string }>)
		: []
	for (const image of images) {
		if (typeof image.uri === 'string' && !image.uri.startsWith('data:')) {
			referencedUris.add(image.uri)
		}
	}

	const buffers = Array.isArray(document.buffers)
		? (document.buffers as Array<{ uri?: string }>)
		: []
	for (const buffer of buffers) {
		if (typeof buffer.uri === 'string' && !buffer.uri.startsWith('data:')) {
			referencedUris.add(buffer.uri)
		}
	}

	return referencedUris
}

function validateAssetDataMap(assetData: SerializedSceneAssetDataMap): void {
	for (const [assetId, asset] of Object.entries(assetData)) {
		if (!asset || typeof asset !== 'object') {
			throw new Error(
				`Scene payload contains invalid asset entry for ${assetId}`
			)
		}

		if (
			typeof asset.fileName !== 'string' ||
			asset.fileName.trim().length === 0
		) {
			throw new Error(
				`Scene payload asset ${assetId} is missing a valid fileName`
			)
		}

		if (
			typeof asset.mimeType !== 'string' ||
			asset.mimeType.trim().length === 0
		) {
			throw new Error(
				`Scene payload asset ${assetId} is missing a valid mimeType`
			)
		}

		if (typeof asset.data === 'string' && asset.encoding === 'base64') {
			if (!isValidBase64(asset.data)) {
				throw new Error(
					`Scene payload asset ${asset.fileName} has invalid base64 data`
				)
			}
		}
	}
}

function validateReferencedAssets(
	gltfJson: ServerSceneData['gltfJson'],
	assetData: SerializedSceneAssetDataMap
): void {
	const referencedUris = collectReferencedUris(gltfJson)

	if (referencedUris.size === 0) {
		return
	}

	const lookup = new Set<string>()
	for (const asset of Object.values(assetData)) {
		for (const key of buildAssetLookupKeys(asset.fileName)) {
			lookup.add(key)
		}
	}

	const missingUris: string[] = []
	for (const uri of referencedUris) {
		const normalized = normalizeAssetUri(uri)
		const basename = normalized.split('/').pop() || normalized
		if (!lookup.has(uri) && !lookup.has(normalized) && !lookup.has(basename)) {
			missingUris.push(uri)
		}
	}

	if (missingUris.length > 0) {
		throw missingAssetsError(
			`Scene payload is missing required referenced assets: ${missingUris.slice(0, 5).join(', ')}`
		)
	}
}

/**
 * Resolves raw scene payload from the API into normalized scene data used by hooks.
 * This keeps payload-shape adaptation in one explicit contract boundary.
 */
export function resolveServerSceneDataContract(
	payload: ServerScenePayload
): ServerSceneData {
	if (!isRecord(payload.gltfJson)) {
		throw new Error('Scene payload is missing a valid glTF document')
	}

	const assetData = payload.assetData ?? {}
	validateAssetDataMap(assetData)
	validateReferencedAssets(payload.gltfJson, assetData)

	return {
		meta: payload.meta,
		gltfJson: payload.gltfJson,
		assetData,
		...toSceneSettings(payload)
	}
}

/**
 * Resolves an embed manifest, which carries a published GLB instead of a glTF
 * document.
 *
 * Same settings normalization as {@link resolveServerSceneDataContract}, minus
 * the referenced-asset cross-check: a GLB is self-contained, so there are no
 * external URIs to reconcile against the asset map.
 */
export function resolvePublishedSceneDataContract(
	payload: ServerScenePayload
): ServerSceneData {
	const assetData = payload.assetData ?? {}
	validateAssetDataMap(assetData)

	return {
		meta: payload.meta,
		gltfJson: null,
		assetData,
		assetRefs: payload.assetRefs ?? {},
		...toSceneSettings(payload)
	}
}
