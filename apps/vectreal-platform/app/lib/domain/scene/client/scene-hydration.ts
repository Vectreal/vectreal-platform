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

export const getSettingsFromAggregate = (
	aggregate: SceneManifestResponse | null
): SceneSettings | null => {
	if (!aggregate) {
		return null
	}

	if (aggregate.settings) {
		const normalizedCamera = normalizeCameraSettings(aggregate.settings.camera)
		return {
			...aggregate.settings,
			camera: normalizedCamera,
			interactions: normalizeSceneInteractions(
				aggregate.settings.interactions,
				{ camera: normalizedCamera }
			)
		}
	}

	const fallbackSettings = aggregate as SceneManifestResponse & {
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

const toNormalizedAggregateGltfJson = (
	aggregate: SceneManifestResponse
): ServerSceneData['gltfJson'] => {
	if (
		typeof aggregate.gltfJson === 'object' &&
		aggregate.gltfJson !== null &&
		'json' in aggregate.gltfJson &&
		typeof (aggregate.gltfJson as { json?: unknown }).json === 'object' &&
		(aggregate.gltfJson as { json?: unknown }).json !== null
	) {
		return (aggregate.gltfJson as { json: unknown })
			.json as ServerSceneData['gltfJson']
	}

	return aggregate.gltfJson as ServerSceneData['gltfJson']
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
	settings: getSettingsFromAggregate(manifest),
	gltfJson: toNormalizedAggregateGltfJson(manifest),
	assetData: null,
	assetRefs: manifest.assetRefs
})
