import type { SceneAggregateResponse } from '../../../../types/api'
import type { SceneMetaState } from '../../../../types/publisher-config'
import type {
	CameraProps,
	CameraStateConfig,
	CameraTransitionConfig,
	SceneSettings,
	ServerSceneData
} from '@vctrl/core'

function normalizeCameraSettings(camera?: CameraProps): CameraProps | undefined {
	if (!camera?.cameras || camera.cameras.length === 0) {
		return camera
	}

	const flattenedCameras = camera.cameras.flatMap((entry, cameraIndex) => {
		if (entry.states && entry.states.length > 0) {
			return entry.states.map((stateEntry, stateIndex) => {
				const {
					stateId: _legacyStateId,
					name: _legacyStateName,
					initial: _legacyInitial,
					transition: stateTransition,
					...stateWithoutLegacyFields
				} = stateEntry
				const stateId =
					typeof stateEntry.stateId === 'string' && stateEntry.stateId.trim()
						? stateEntry.stateId.trim()
						: `${entry.cameraId || `camera-${cameraIndex + 1}`}-state-${stateIndex + 1}`
				const stateName =
					typeof stateEntry.name === 'string' && stateEntry.name.trim()
						? stateEntry.name.trim()
						: `${entry.name || `Camera ${cameraIndex + 1}`} ${stateIndex + 1}`
				const transition: CameraTransitionConfig | undefined =
					stateTransition ??
					entry.transition ??
					(entry.shouldAnimate === false
						? { type: 'none' }
						: {
							type: 'linear',
							duration: entry.animationConfig?.duration ?? 1000,
							easing: 'ease_in_out'
						})

				return {
					...entry,
					...stateWithoutLegacyFields,
					cameraId: stateId,
					name: stateName,
					initial: Boolean(
						_legacyInitial ||
							(entry.activeStateId && entry.activeStateId === stateId)
					),
					transition
				}
			})
		}

		const fallbackTransition: CameraTransitionConfig | undefined =
			entry.transition ??
			(entry.shouldAnimate === false
				? { type: 'none' }
				: {
					type: 'linear',
					duration: entry.animationConfig?.duration ?? 1000,
					easing: 'ease_in_out'
				})

		return [
			{
				...entry,
				cameraId: entry.cameraId || `camera-${cameraIndex + 1}`,
				name: entry.name || `Camera ${cameraIndex + 1}`,
				transition: fallbackTransition
			}
		]
	})

	const uniqueCameraIds = new Set<string>()
	const normalizedCameras = flattenedCameras.map((cameraEntry, index) => {
		const cameraId = cameraEntry.cameraId || `camera-${index + 1}`
		let normalizedCameraId = cameraId
		if (uniqueCameraIds.has(normalizedCameraId)) {
			normalizedCameraId = `${cameraId}-${index + 1}`
		}
		uniqueCameraIds.add(normalizedCameraId)

		const {
			states: _states,
			activeStateId: _activeStateId,
			shouldAnimate: _shouldAnimate,
			animationConfig: _animationConfig,
			...cameraWithoutLegacyFields
		} = cameraEntry

		return {
			...cameraWithoutLegacyFields,
			cameraId: normalizedCameraId,
			name: cameraEntry.name || `Camera ${index + 1}`
		}
	})

	const resolvedActiveCameraId =
		(camera.activeCameraId &&
		normalizedCameras.some(
			(entry) => entry.cameraId === camera.activeCameraId
		)
			? camera.activeCameraId
			: undefined) ??
		(normalizedCameras.find((entry) => entry.initial)?.cameraId ??
			normalizedCameras[0]?.cameraId)

	if (!resolvedActiveCameraId) {
		return camera
	}

	return {
		...camera,
		activeCameraId: resolvedActiveCameraId,
		cameras: normalizedCameras.map((entry) => ({
			...entry,
			initial: entry.cameraId === resolvedActiveCameraId
		}))
	}
}

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
		return {
			...aggregate.settings,
			camera: normalizeCameraSettings(aggregate.settings.camera)
		}
	}

	const fallbackSettings = aggregate as SceneAggregateResponse & {
		camera?: SceneSettings['camera']
		environment?: SceneSettings['environment']
		controls?: SceneSettings['controls']
		shadows?: SceneSettings['shadows']
	}

	if (
		fallbackSettings.camera ||
		fallbackSettings.environment ||
		fallbackSettings.controls ||
		fallbackSettings.shadows
	) {
		return {
			camera: normalizeCameraSettings(fallbackSettings.camera),
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
