/**
 * The rules a scene's camera settings follow, in one place.
 *
 * Writes are held to the zod schema here: the platform's save parser and the
 * `@vctrl/sdk` contract refuse what fails it. Reads go through
 * `./camera-rules`, which this schema is built on: `normalizeCameraSettings`
 * drops what the viewer cannot use rather than refusing, so a scene stored
 * before a rule existed still opens.
 *
 * Published at `@vctrl/core/camera-schema` and importing nothing but zod, so
 * the SDK can carry it without installing a renderer. The core root does not
 * re-export it, which keeps zod out of every viewer bundle.
 */
import { z } from 'zod'

import {
	CAMERA_FOV_MAX,
	CAMERA_FOV_MIN,
	CAMERA_VECTOR_FIELDS,
	isSceneCamera
} from './camera-rules'
import { isFramingAspect } from '../scene-camera/viewport-framing'

export * from './camera-rules'

// zod 4 refuses Infinity and NaN for any number already. Each rule carries
// the words a refusal shows, written for whoever sent the value.
const finite = z.number({ error: 'must be a number' })

const FOV_RANGE = 'must be a number of degrees between 0 and 180'
/** `isCameraFov` as a write rule. */
export const cameraFovSchema = z
	.number({ error: FOV_RANGE })
	.gt(CAMERA_FOV_MIN, { error: FOV_RANGE })
	.lt(CAMERA_FOV_MAX, { error: FOV_RANGE })

export const cameraKindSchema = z.enum(['scene', 'hotspot'], {
	error: "must be 'scene' or 'hotspot'"
})

/**
 * A 3D vector as `[x, y, z]`, or as the `{ x, y, z }` three.js objects
 * serialize to. Both read as the tuple.
 */
export const cameraVectorSchema = z.union(
	[
		z.tuple([finite, finite, finite]),
		z
			.strictObject({ x: finite, y: finite, z: finite })
			.transform(({ x, y, z }): [number, number, number] => [x, y, z])
	],
	{ error: 'must be [x, y, z] or {x, y, z} of finite numbers' }
)

const NON_NEGATIVE = 'must be a non-negative number'

/** Ignored by the viewer; still refused when malformed, as it always was. */
const objectAvoidanceSchema = z.looseObject(
	{
		clearance: finite.optional(),
		arcHeight: finite.optional(),
		samples: z
			.number({ error: 'must be a number >= 2' })
			.min(2, { error: 'must be a number >= 2' })
			.optional(),
		tension: finite.optional()
	},
	{ error: 'must be an object when provided' }
)

export const cameraTransitionSchema = z
	.looseObject(
		{
			type: z.enum(['linear', 'object_avoidance', 'none'], {
				error: 'must be one of linear, object_avoidance, none'
			}),
			duration: z
				.number({ error: NON_NEGATIVE })
				.min(0, { error: NON_NEGATIVE })
				.optional(),
			easing: z
				.enum(['linear', 'ease_in', 'ease_out', 'ease_in_out'], {
					error: 'must be one of linear, ease_in, ease_out, ease_in_out'
				})
				.optional()
		},
		{ error: 'must be an object' }
	)
	// Only the type that uses them reads its avoidance settings; another type
	// carries them as stored.
	.superRefine((transition, context) => {
		if (
			transition.type !== 'object_avoidance' ||
			transition['objectAvoidance'] === undefined
		) {
			return
		}
		const avoidance = objectAvoidanceSchema.safeParse(
			transition['objectAvoidance']
		)
		for (const issue of avoidance.error?.issues ?? []) {
			context.addIssue({
				code: 'custom',
				message: issue.message,
				path: ['objectAvoidance', ...issue.path]
			})
		}
	})

/**
 * The fields of one camera that have a rule. A field without one (a three.js
 * prop such as `near`) is carried as stored.
 */
const CAMERA_FIELD_SCHEMAS = {
	cameraId: z.string({ error: 'must be a string' }),
	name: z.string({ error: 'must be a string' }),
	kind: cameraKindSchema,
	initial: z.boolean({ error: 'must be a boolean' }),
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
	),
	{ error: 'must be an object' }
)

/**
 * Camera settings as a write must send them: at least one camera, at least one
 * of them a scene camera to open on, every field that has a rule within it.
 */
export const cameraSettingsSchema = z.looseObject({
	activeCameraId: z.string({ error: 'must be a string' }).optional(),
	cameras: z
		.array(cameraEntrySchema, { error: 'must be a non-empty array' })
		.min(1, { error: 'must be a non-empty array' })
		.refine((cameras) => cameras.some(isSceneCamera), {
			message: 'must contain at least one scene camera'
		}),
	sceneTransition: cameraTransitionSchema.optional(),
	/** The viewer hides its switcher only for a literal `false`. */
	showControls: z.boolean({ error: 'must be a boolean' }).optional()
})
