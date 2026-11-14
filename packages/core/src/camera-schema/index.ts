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
	CAMERA_TRANSITION_EASINGS,
	CAMERA_TRANSITION_TYPES,
	CAMERA_VECTOR_FIELDS
} from './camera-rules'

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
			type: z.enum(CAMERA_TRANSITION_TYPES, {
				error: 'must be one of linear, object_avoidance, none'
			}),
			duration: z
				.number({ error: NON_NEGATIVE })
				.min(0, { error: NON_NEGATIVE })
				.optional(),
			easing: z
				.enum(CAMERA_TRANSITION_EASINGS, {
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

const vector = cameraVectorSchema.optional()

/**
 * One camera. Every field with a rule is held to it; a field without one (a
 * three.js prop such as `near`) is carried as stored.
 */
export const cameraEntrySchema = z.looseObject(
	{
		cameraId: z.string({ error: 'must be a string' }).optional(),
		name: z.string({ error: 'must be a string' }).optional(),
		kind: cameraKindSchema.optional(),
		initial: z.boolean({ error: 'must be a boolean' }).optional(),
		fov: cameraFovSchema.optional(),
		// `isFramingAspect` as a write rule, spelled out so it has a JSON Schema
		// (an MCP tool's input is one).
		framingAspect: z
			.number({ error: 'must be a positive finite number' })
			.gt(0, { error: 'must be a positive finite number' })
			.optional(),
		transition: cameraTransitionSchema.optional(),
		position: vector,
		target: vector,
		rotation: vector,
		/** The legacy name for `target`. */
		lookAt: vector
	} satisfies Record<(typeof CAMERA_VECTOR_FIELDS)[number], unknown> &
		Record<string, z.ZodType>,
	{ error: 'must be an object' }
)

/**
 * Camera settings as a write must send them: at least one camera, every field
 * that has a rule within it. A list of hotspot cameras only is allowed: the
 * publisher builds one when a hotspot is added to a scene with no camera, and
 * the scene then opens on the first camera.
 */
export const cameraSettingsSchema = z.looseObject({
	activeCameraId: z.string({ error: 'must be a string' }).optional(),
	cameras: z
		.array(cameraEntrySchema, { error: 'must be a non-empty array' })
		.min(1, { error: 'must be a non-empty array' }),
	sceneTransition: cameraTransitionSchema.optional(),
	/** The viewer hides its switcher only for a literal `false`. */
	showControls: z.boolean({ error: 'must be a boolean' }).optional()
})
