import { ApiResponse } from '@shared/utils'
import { normalizeCameraSettings } from '@vctrl/core'
import { cameraSettingsSchema } from '@vctrl/core/camera-schema'

import {
	applyDefaultCameraFlag,
	resolveDefaultSceneCameraId
} from '../scene-camera'

import type { CameraProps } from '@vctrl/core'

export type CameraEntry = NonNullable<CameraProps['cameras']>[number]

/**
 * Where a refused value sits, as the sender wrote it, with the camera's name
 * when it has one: `camera.cameras[0].fov`, `(camera "Hero")`.
 */
function describeIssue(
	camera: CameraProps,
	{ path, message }: { path: readonly PropertyKey[]; message: string }
): string {
	const where = path.reduce<string>(
		(out, key) =>
			typeof key === 'number' ? `${out}[${key}]` : `${out}.${String(key)}`,
		'camera'
	)
	const name =
		path[0] === 'cameras' && typeof path[1] === 'number'
			? (camera.cameras?.[path[1]] as { name?: unknown } | undefined)?.name
			: undefined
	return typeof name === 'string' && name.trim()
		? `${where} ${message} (camera "${name.trim()}")`
		: `${where} ${message}`
}

/**
 * A camera section as a save stores it, or the refusal to send.
 *
 * Every rule a camera value follows is `@vctrl/core/camera-schema`'s, the
 * same one the SDK contract, hydration and the viewer use; this adds only
 * what needs the whole list: default ids and names, unique ids, and the
 * first scene camera as the one the scene opens on.
 */
export function parseCameraSettings(
	camera?: CameraProps
): CameraProps | undefined | Response {
	if (!camera) {
		return camera
	}

	const parsed = cameraSettingsSchema.safeParse(camera)
	if (!parsed.success) {
		return ApiResponse.badRequest(describeIssue(camera, parsed.error.issues[0]))
	}

	const normalizedCameras: CameraEntry[] = []
	const seenCameraIds = new Set<string>()

	for (const [cameraIndex, entry] of (
		parsed.data.cameras as CameraEntry[]
	).entries()) {
		const cameraId = entry.cameraId?.trim() || `camera-${cameraIndex + 1}`
		const name = entry.name?.trim() || `Camera ${cameraIndex + 1}`

		if (seenCameraIds.has(cameraId)) {
			return ApiResponse.badRequest(`Duplicate cameraId found: ${cameraId}`)
		}
		seenCameraIds.add(cameraId)

		normalizedCameras.push({ ...entry, cameraId, name })
	}

	return normalizeCameraSettings({
		...(parsed.data as CameraProps),
		// The first scene camera, or the first camera when none is.
		activeCameraId: resolveDefaultSceneCameraId(normalizedCameras),
		cameras: applyDefaultCameraFlag(normalizedCameras)
	})
}
