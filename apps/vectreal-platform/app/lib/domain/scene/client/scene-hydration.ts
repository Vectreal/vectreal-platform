import {
	normalizeCameraSettings,
	normalizeSceneInteractions,
	type SceneSettings,
	type ServerSceneData
} from '@vctrl/core'

import type { SceneManifestResponse } from '../../../../types/api'
import type { ServerScenePayload } from '@vctrl/core'

export const getSceneNameFromFileName = (fileName: string): string => {
	const trimmedFileName = fileName.trim()
	if (!trimmedFileName) {
		return ''
	}

	const withoutPath = trimmedFileName.split(/[/\\]/).pop() ?? trimmedFileName
	const extensionIndex = withoutPath.lastIndexOf('.')

	if (extensionIndex <= 0) {
		return withoutPath
	}

	return withoutPath.slice(0, extensionIndex)
}

export const getSettingsFromManifest = (
	manifest: SceneManifestResponse | null
): SceneSettings | null => {
	if (!manifest) {
		return null
	}

	if (manifest.settings) {
		const normalizedCamera = normalizeCameraSettings(manifest.settings.camera)
		return {
			...manifest.settings,
			camera: normalizedCamera,
			interactions: normalizeSceneInteractions(manifest.settings.interactions, {
				camera: normalizedCamera
			})
		}
	}

	const fallbackSettings = manifest as SceneManifestResponse & {
		camera?: SceneSettings['camera']
		interactions?: SceneSettings['interactions']
		environment?: SceneSettings['environment']
		controls?: SceneSettings['controls']
		shadows?: SceneSettings['shadows']
		normalization?: SceneSettings['normalization']
	}
	const normalizedFallbackCamera = normalizeCameraSettings(
		fallbackSettings.camera
	)

	if (
		fallbackSettings.camera ||
		fallbackSettings.interactions ||
		fallbackSettings.environment ||
		fallbackSettings.controls ||
		fallbackSettings.shadows ||
		fallbackSettings.normalization
	) {
		return {
			camera: normalizedFallbackCamera,
			interactions: normalizeSceneInteractions(fallbackSettings.interactions, {
				camera: normalizedFallbackCamera
			}),
			environment: fallbackSettings.environment,
			controls: fallbackSettings.controls,
			shadows: fallbackSettings.shadows,
			normalization: fallbackSettings.normalization
		}
	}

	return null
}

const toNormalizedManifestGltfJson = (
	manifest: SceneManifestResponse
): ServerSceneData['gltfJson'] => {
	if (
		typeof manifest.gltfJson === 'object' &&
		manifest.gltfJson !== null &&
		'json' in manifest.gltfJson &&
		typeof (manifest.gltfJson as { json?: unknown }).json === 'object' &&
		(manifest.gltfJson as { json?: unknown }).json !== null
	) {
		return (manifest.gltfJson as { json: unknown })
			.json as ServerSceneData['gltfJson']
	}

	return manifest.gltfJson as ServerSceneData['gltfJson']
}

/**
 * The payload the loader needs to put a saved scene on screen.
 *
 * The route manifest ships the glTF JSON inline and its binary assets by
 * reference; the loader resolves those references itself, so this is a shape
 * conversion, not a fetch.
 */
export const toSceneSourcePayload = (
	manifest: SceneManifestResponse
): ServerScenePayload => ({
	meta: manifest.meta ?? undefined,
	settings: getSettingsFromManifest(manifest),
	gltfJson: toNormalizedManifestGltfJson(manifest),
	assetData: null,
	assetRefs: manifest.assetRefs
})
