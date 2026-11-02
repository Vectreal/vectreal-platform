import { slugify } from '@shared/utils'
import { DEFAULT_SCENE_TRANSITION } from '@vctrl/core'

import { defaultCameraOptions } from './constants'
import { applyDefaultCameraFlag } from '../../../../../lib/domain/scene/scene-camera'

import type {
	CameraProps,
	CameraTransitionConfig,
	CameraTransitionEasing,
	CameraTransitionType
} from '@vctrl/core'
import type { SceneCameraSnapshot } from '@vctrl/viewer'

export type CameraEntry = NonNullable<CameraProps['cameras']>[number]

export const TRANSITION_TYPE_OPTIONS: {
	value: CameraTransitionType
	label: string
}[] = [
	{ value: 'none', label: 'Instant' },
	{ value: 'linear', label: 'Linear' },
	{ value: 'object_avoidance', label: 'Smart' }
]

export const TRANSITION_EASING_OPTIONS: {
	value: CameraTransitionEasing
	label: string
}[] = [
	{ value: 'linear', label: 'Linear' },
	{ value: 'ease_in', label: 'Ease in' },
	{ value: 'ease_out', label: 'Ease out' },
	{ value: 'ease_in_out', label: 'Smooth' }
]

/**
 * The scene transition with every field its type uses filled in, so the
 * editor can spread it into an edit without re-applying defaults.
 */
export function normalizeTransition(
	transition?: CameraTransitionConfig
): CameraTransitionConfig {
	if (transition?.type === 'none') {
		return { type: 'none' }
	}

	const timing = {
		duration: transition?.duration ?? DEFAULT_SCENE_TRANSITION.duration,
		easing: transition?.easing ?? DEFAULT_SCENE_TRANSITION.easing
	}

	// A saved `objectAvoidance` is dropped: Smart takes its clearance from
	// the model's size, and the viewer no longer reads those fields.
	return {
		type: transition?.type ?? DEFAULT_SCENE_TRANSITION.type,
		...timing
	}
}

export function applySnapshotToCamera(
	cameraEntry: CameraEntry,
	snapshot: null | SceneCameraSnapshot
): CameraEntry {
	if (!snapshot) {
		return cameraEntry
	}

	return {
		...cameraEntry,
		position: snapshot.position,
		rotation: snapshot.rotation,
		target: snapshot.target,
		fov: snapshot.fov,
		framingAspect: snapshot.framingAspect
	}
}

/** The camera the editor is working on: the selection, else the active one, else the first. */
export function resolveEditorTargetCameraId(
	normalizedCamera: CameraProps,
	selectedCameraId?: string
): string {
	return (
		selectedCameraId ??
		normalizedCamera.activeCameraId ??
		normalizedCamera.cameras?.[0]?.cameraId ??
		''
	)
}

export function withDefaultCameraFlag(camera: CameraProps): CameraProps {
	return { ...camera, cameras: applyDefaultCameraFlag(camera.cameras ?? []) }
}

/**
 * Camera state the editor can rely on: at least one camera, every camera
 * named and carrying a unique id, and an active camera that exists.
 */
export function normalizeCameraState(camera: CameraProps): CameraProps {
	const sourceCameras =
		camera.cameras && camera.cameras.length > 0
			? camera.cameras
			: (defaultCameraOptions.cameras ?? [])

	const seenCameraIds = new Set<string>()
	const normalizedCameras = sourceCameras.map((entry, index) => {
		const nameForId =
			typeof entry.name === 'string' && entry.name.trim()
				? entry.name
				: `Camera ${index + 1}`
		const base = entry.cameraId || slugify(nameForId)
		let cameraId = base
		let n = 2
		while (seenCameraIds.has(cameraId)) {
			cameraId = `${base}-${n++}`
		}
		seenCameraIds.add(cameraId)

		return {
			...entry,
			cameraId,
			name: typeof entry.name === 'string' ? entry.name : `Camera ${index + 1}`
		}
	})

	const fallbackCamera = normalizedCameras[0]
	if (!fallbackCamera) {
		return defaultCameraOptions
	}

	const activeCameraId =
		(camera.activeCameraId &&
		normalizedCameras.some((entry) => entry.cameraId === camera.activeCameraId)
			? camera.activeCameraId
			: undefined) ??
		normalizedCameras.find((entry) => entry.initial)?.cameraId ??
		fallbackCamera.cameraId

	return withDefaultCameraFlag({
		...camera,
		activeCameraId,
		cameras: normalizedCameras
	})
}
