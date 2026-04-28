import {
	buildAssetLookupKeys,
	CameraProps,
	CameraTransitionConfig,
	isValidBase64,
	normalizeAssetUri
} from '@vctrl/core'

import type {
	SceneSettings,
	SerializedSceneAssetDataMap,
	ServerSceneData,
	ServerScenePayload
} from '@vctrl/core'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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

	const seenCameraIds = new Set<string>()
	const normalizedCameras = flattenedCameras.map((entry, index) => {
		const rawCameraId = entry.cameraId || `camera-${index + 1}`
		const cameraId = seenCameraIds.has(rawCameraId)
			? `${rawCameraId}-${index + 1}`
			: rawCameraId
		seenCameraIds.add(cameraId)

		const {
			states: _states,
			activeStateId: _activeStateId,
			shouldAnimate: _shouldAnimate,
			animationConfig: _animationConfig,
			...cameraWithoutLegacyFields
		} = entry

		return {
			...cameraWithoutLegacyFields,
			cameraId,
			name: entry.name || `Camera ${index + 1}`
		}
	})

	const activeCameraId =
		(camera.activeCameraId &&
		normalizedCameras.some((entry) => entry.cameraId === camera.activeCameraId)
			? camera.activeCameraId
			: undefined) ??
		(normalizedCameras.find((entry) => entry.initial)?.cameraId ??
			normalizedCameras[0]?.cameraId)

	if (!activeCameraId) {
		return camera
	}

	return {
		...camera,
		activeCameraId,
		cameras: normalizedCameras.map((entry) => ({
			...entry,
			initial: entry.cameraId === activeCameraId
		}))
	}
}

function toSceneSettings(payload: ServerScenePayload): SceneSettings {
	const nestedSettings = isRecord(payload.settings)
		? (payload.settings as SceneSettings)
		: {}
	const resolvedCamera = normalizeCameraSettings(
		(payload.camera ?? nestedSettings.camera) as CameraProps | undefined
	)

	return {
		...nestedSettings,
		bounds: payload.bounds ?? nestedSettings.bounds,
		camera: resolvedCamera,
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
