import type { SceneAggregateResponse } from '../../../../types/api'
import type { SceneMetaState } from '../../../../types/publisher-config'
import type { SceneSettings, ServerSceneData } from '@vctrl/core'

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
	aggregate: SceneAggregateResponse | null
): SceneSettings | null => {
	if (!aggregate) {
		return null
	}

	if (aggregate.settings) {
		return aggregate.settings
	}

	const fallbackSettings = aggregate as SceneAggregateResponse & {
		environment?: SceneSettings['environment']
		controls?: SceneSettings['controls']
		shadows?: SceneSettings['shadows']
	}

	if (
		fallbackSettings.environment ||
		fallbackSettings.controls ||
		fallbackSettings.shadows
	) {
		return {
			environment: fallbackSettings.environment,
			controls: fallbackSettings.controls,
			shadows: fallbackSettings.shadows
		}
	}

	return null
}

const toNormalizedAggregateGltfJson = (
	aggregate: SceneAggregateResponse
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

interface ExecuteAggregateSceneHydrationParams {
	sceneId: string
	aggregate: SceneAggregateResponse
	hydrateOptimizationState: (aggregate: SceneAggregateResponse) => void
	applySceneSettings: (settings: SceneSettings) => void
	setSceneMetaState: (sceneMeta: SceneMetaState) => void
	setLastSavedSceneMeta: (sceneMeta: SceneMetaState) => void
	loadFromData: (params: {
		sceneId: string
		sceneData: ServerSceneData
	}) => Promise<unknown>
}

export const executeAggregateSceneHydration = async ({
	sceneId,
	aggregate,
	hydrateOptimizationState,
	applySceneSettings,
	setSceneMetaState,
	setLastSavedSceneMeta,
	loadFromData
}: ExecuteAggregateSceneHydrationParams): Promise<string> => {
	hydrateOptimizationState(aggregate)

	const settings = getSettingsFromAggregate(aggregate)
	if (settings) {
		applySceneSettings(settings)
	}

	if (aggregate.meta) {
		setSceneMetaState(aggregate.meta)
		setLastSavedSceneMeta(aggregate.meta)
	}

	if (aggregate.gltfJson && aggregate.assetData) {
		const sceneData: ServerSceneData = {
			meta: aggregate.meta
				? {
						name: aggregate.meta.name,
						description: aggregate.meta.description,
						thumbnailUrl: aggregate.meta.thumbnailUrl
					}
				: undefined,
			gltfJson: toNormalizedAggregateGltfJson(aggregate),
			assetData: aggregate.assetData,
			...settings
		}

		await loadFromData({
			sceneId,
			sceneData
		})
	}

	return aggregate.meta?.name || sceneId
}
