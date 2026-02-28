import type {
	SceneSettings,
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

	return {
		meta: payload.meta,
		gltfJson: payload.gltfJson,
		assetData: payload.assetData ?? {},
		...toSceneSettings(payload)
	}
}
