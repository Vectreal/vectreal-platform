import { buildAssetLookupKeys, isValidBase64, normalizeAssetUri } from '@vctrl/core'

import type {
	SceneSettings,
	SerializedSceneAssetDataMap,
	ServerSceneData,
	ServerScenePayload
} from '@vctrl/core'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toSceneSettings(payload: ServerScenePayload): SceneSettings {
	const nestedSettings = isRecord(payload.settings)
		? (payload.settings as SceneSettings)
		: {}

	return {
		...nestedSettings,
		bounds: payload.bounds ?? nestedSettings.bounds,
		camera: payload.camera ?? nestedSettings.camera,
		controls: payload.controls ?? nestedSettings.controls,
		environment: payload.environment ?? nestedSettings.environment,
		shadows: payload.shadows ?? nestedSettings.shadows
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
			throw new Error(`Scene payload contains invalid asset entry for ${assetId}`)
		}

		if (typeof asset.fileName !== 'string' || asset.fileName.trim().length === 0) {
			throw new Error(
				`Scene payload asset ${assetId} is missing a valid fileName`
			)
		}

		if (typeof asset.mimeType !== 'string' || asset.mimeType.trim().length === 0) {
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
		throw new Error(
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
