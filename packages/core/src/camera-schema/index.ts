/**
 * The rules a scene's camera settings follow, in one place.
 *
 * Every layer that takes camera settings in asks this module: the platform's
 * save parser and the `@vctrl/sdk` contract refuse what fails it on write, and
 * `normalizeCameraSettings` repairs what fails it on read, so a scene stored
 * before a rule existed still opens. The viewer's lens reads `isCameraFov`.
 *
 * Published at `@vctrl/core/camera-schema` and importing nothing but zod, so
 * the SDK can carry it without installing a renderer.
 */
import { z } from 'zod'

import { isFramingAspect } from '../scene-camera/viewport-framing'

/**
 * Scene cameras are the ones a viewer can open on and switch between. Entries
 * with another `kind` (a hotspot's close-up) are reached through their marker.
 * A missing `kind` predates the field and means "scene".
 */
export const isSceneCamera = (camera: { kind?: string }): boolean =>
	!camera.kind || camera.kind === 'scene'

// zod 4 refuses Infinity and NaN for any number already.
const finite = z.number()

/**
 * A perspective lens's vertical field of view, in degrees. Outside the open
 * range the projection is degenerate or inverted, and the viewer draws
 * nothing usable.
 */
export const cameraFovSchema = finite.gt(0).lt(180)

/** Whether `value` is a field of view the viewer can set on its lens. */
export const isCameraFov = (value: unknown): value is number =>
	cameraFovSchema.safeParse(value).success

export const cameraKindSchema = z.enum(['scene', 'hotspot'])

/**
 * A 3D vector as `[x, y, z]`, or as the `{ x, y, z }` three.js objects
 * serialize to. Both read as the tuple.
 */
export const cameraVectorSchema = z.union([
	z.tuple([finite, finite, finite]),
	z
		.strictObject({ x: finite, y: finite, z: finite })
		.transform(({ x, y, z }): [number, number, number] => [x, y, z])
])

/** The camera fields that hold a vector. `lookAt` is the legacy `target`. */
export const CAMERA_VECTOR_FIELDS = [
	'position',
	'target',
	'rotation',
	'lookAt'
] as const

export const cameraTransitionSchema = z.looseObject({
	type: z.enum(['linear', 'object_avoidance', 'none']),
	duration: finite.min(0).optional(),
	easing: z.enum(['linear', 'ease_in', 'ease_out', 'ease_in_out']).optional(),
	/** Ignored by the viewer; still refused when malformed, as it always was. */
	objectAvoidance: z
		.looseObject({
			clearance: finite.optional(),
			arcHeight: finite.optional(),
			samples: finite.min(2).optional(),
			tension: finite.optional()
		})
		.optional()
})

/**
 * The fields of one camera that have a rule. A field without one (a three.js
 * prop such as `near`) is carried as stored.
 */
const CAMERA_FIELD_SCHEMAS = {
	cameraId: z.string(),
	name: z.string(),
	kind: cameraKindSchema,
	initial: z.boolean(),
	fov: cameraFovSchema,
	framingAspect: z.custom<number>(isFramingAspect, {
		message: 'must be a positive finite number'
	}),
	transition: cameraTransitionSchema,
	...Object.fromEntries(
		CAMERA_VECTOR_FIELDS.map((field) => [field, cameraVectorSchema])
	)
} as Record<string, z.ZodType>

export const cameraEntrySchema = z.looseObject(
	Object.fromEntries(
		Object.entries(CAMERA_FIELD_SCHEMAS).map(([field, schema]) => [
			field,
			schema.optional()
		])
	)
)

/**
 * Camera settings as a write must send them: at least one camera, at least one
 * of them a scene camera to open on, every field that has a rule within it.
 */
export const cameraSettingsSchema = z.looseObject({
	activeCameraId: z.string().optional(),
	cameras: z
		.array(cameraEntrySchema)
		.min(1)
		.refine((cameras) => cameras.some(isSceneCamera), {
			message: 'must contain at least one scene camera'
		}),
	sceneTransition: cameraTransitionSchema.optional(),
	/** The viewer hides its switcher only for a literal `false`. */
	showControls: z.boolean().optional()
})

/** One stored value `repairCameraEntry` dropped, for whoever logs it. */
export interface CameraRepair {
	cameraIndex: number
	field: string
}

/**
 * A stored camera with each field that fails its rule dropped, so the viewer
 * falls back to its default for that field rather than drawing garbage. A
 * vector in either accepted form comes back as the tuple. Never refuses: a
 * published scene keeps opening whatever an older save wrote.
 */
export function repairCameraEntry<Entry extends Record<string, unknown>>(
	entry: Entry,
	cameraIndex: number
): { entry: Entry; repairs: CameraRepair[] } {
	const repaired: Record<string, unknown> = { ...entry }
	const repairs: CameraRepair[] = []

	for (const [field, schema] of Object.entries(CAMERA_FIELD_SCHEMAS)) {
		if (repaired[field] === undefined) continue
		const parsed = schema.safeParse(repaired[field])
		if (parsed.success) {
			repaired[field] = parsed.data
		} else {
			delete repaired[field]
			repairs.push({ cameraIndex, field })
		}
	}

	return { entry: repaired as Entry, repairs }
}
