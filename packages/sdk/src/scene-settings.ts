import { z } from 'zod'

/*
  How a scene looks: the settings sections the viewer passes to its 3D
  components as they are stored. Every scene save, the publisher's included,
  goes through this schema, so it says what may be stored, and the viewer runs
  inside customers' pages with whatever that is.

  Keys it does not name are dropped rather than refused, so a scene saved with
  a key that has since gone (shadows' legacy `type`) still saves. That is also
  why `environment.files` is absent: the viewer fetches it as the scene's HDR,
  so storing it would let a save point every visitor's browser at any URL.
  The hosted HDR for `preset` is the only environment a scene can have.

  A key it names with the wrong type is refused. Limits sit only where a value
  costs visitors: how often and how large the shadow bake renders, and how
  many lights draw a shadow.
*/

// zod 4 refuses Infinity and NaN for any number already.
const finite = z.number()
const nonNegative = finite.min(0)
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i)
const vector3 = z.tuple([finite, finite, finite])

/** The hosted environment maps, named `<type>-<label>`. */
export const ENVIRONMENT_PRESETS = [
	'nature-moonlit',
	'nature-park',
	'nature-park-overcast',
	'nature-snow',
	'night-building',
	'night-city',
	'night-pure-sky',
	'night-stars',
	'outdoor-golden-hour',
	'outdoor-noon',
	'outdoor-overcast',
	'outdoor-sky',
	'studio-key',
	'studio-natural',
	'studio-soft'
] as const

export const sceneBoundsSchema = z.object({
	enable: z.boolean().optional(),
	fit: z.boolean().optional(),
	clip: z.boolean().optional(),
	observe: z.boolean().optional(),
	margin: nonNegative.optional(),
	maxDuration: nonNegative.optional()
})

export const sceneControlsSchema = z.object({
	controlsTimeout: nonNegative.optional(),
	makeDefault: z.boolean().optional(),
	enableRotate: z.boolean().optional(),
	enableZoom: z.boolean().optional(),
	enablePan: z.boolean().optional(),
	enableDamping: z.boolean().optional(),
	dampingFactor: nonNegative.optional(),
	rotateSpeed: nonNegative.optional(),
	panSpeed: nonNegative.optional(),
	zoomSpeed: nonNegative.optional(),
	autoRotate: z.boolean().optional(),
	autoRotateSpeed: finite.optional(),
	minPolarAngle: finite.optional(),
	maxPolarAngle: finite.optional(),
	minDistance: nonNegative.optional(),
	maxDistance: nonNegative.optional()
})

/** A flat stage the viewer paints behind the model. */
const sceneStageSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('color'), color: hexColor }),
	z.object({
		type: z.literal('gradient'),
		top: hexColor,
		bottom: hexColor
	})
])

export const sceneEnvironmentSchema = z.object({
	preset: z.enum(ENVIRONMENT_PRESETS).optional(),
	environmentResolution: z.enum(['1k', '4k']).optional(),
	environmentIntensity: nonNegative.optional(),
	background: z.boolean().optional(),
	backgroundIntensity: nonNegative.optional(),
	backgroundBlurriness: nonNegative.optional(),
	backdrop: sceneStageSchema.optional()
})

export const sceneShadowsSchema = z.object({
	enabled: z.boolean().optional(),
	temporal: z.boolean().optional(),
	frames: z.number().int().min(1).max(1000).optional(),
	resolution: z.number().int().min(16).max(4096).optional(),
	alphaTest: finite.optional(),
	cutoffScale: nonNegative.optional(),
	opacity: nonNegative.optional(),
	scale: nonNegative.optional(),
	colorBlend: nonNegative.optional(),
	color: hexColor.optional(),
	ao: z.boolean().optional(),
	aoIntensity: nonNegative.optional(),
	aoAtRest: z.boolean().optional(),
	contact: z
		.object({
			enabled: z.boolean().optional(),
			opacity: nonNegative.optional(),
			blur: nonNegative.optional(),
			scale: nonNegative.optional(),
			reach: nonNegative.optional()
		})
		.optional(),
	light: z
		.object({
			intensity: nonNegative.optional(),
			amount: z.number().int().min(1).max(64).optional(),
			radius: nonNegative.optional(),
			ambient: nonNegative.optional(),
			position: vector3.optional(),
			bias: finite.optional()
		})
		.optional(),
	baked: z
		.object({
			assetId: z.string(),
			signature: z.string(),
			basis: z
				.object({
					footprint: finite,
					radius: finite,
					vertexCount: nonNegative
				})
				.optional()
		})
		.optional()
})

/** A scene has at most one light per role, so at most three lights. */
export const SCENE_LIGHT_ROLES = ['key', 'fill', 'rim'] as const

/**
 * How a scene is lit: an environment and up to three studio lights, from which
 * every shadow follows. Supersedes `environment` and `shadows`, which stay
 * accepted for scenes saved before it.
 */
export const sceneLightingSchema = z.object({
	environment: z
		.object({
			map: z.enum(ENVIRONMENT_PRESETS).optional(),
			resolution: z.enum(['1k', '4k']).optional(),
			intensity: nonNegative.optional(),
			rotation: finite.optional()
		})
		.optional(),
	lights: z
		.array(
			z.object({
				role: z.enum(SCENE_LIGHT_ROLES),
				enabled: z.boolean().optional(),
				azimuth: finite.optional(),
				elevation: finite.min(-90).max(90).optional(),
				size: finite.min(0).max(180).optional(),
				intensity: nonNegative.optional(),
				color: hexColor.optional()
			})
		)
		// One light per role, which also caps a scene at three.
		.refine(
			(lights) =>
				new Set(lights.map((light) => light.role)).size === lights.length,
			'Each light role may appear once.'
		)
		.optional(),
	ground: z.object({ enabled: z.boolean().optional() }).optional(),
	background: z
		.discriminatedUnion('type', [
			z.object({
				type: z.literal('environment'),
				intensity: nonNegative.optional(),
				blur: nonNegative.optional()
			}),
			...sceneStageSchema.options,
			z.object({ type: z.literal('none') })
		])
		.optional(),
	occlusion: z
		.object({
			mode: z.enum(['off', 'live']).optional(),
			live: z
				.object({
					intensity: nonNegative.optional(),
					atRest: z.boolean().optional()
				})
				.optional()
		})
		.optional()
})

export const sceneNormalizationSchema = z.object({
	enabled: z.boolean(),
	minSize: nonNegative.optional(),
	maxSize: nonNegative.optional()
})

/** The look sections of a scene's settings; each one may be left out. */
export const sceneLookSchema = z.object({
	bounds: sceneBoundsSchema.optional(),
	controls: sceneControlsSchema.optional(),
	lighting: sceneLightingSchema.optional(),
	environment: sceneEnvironmentSchema.optional(),
	shadows: sceneShadowsSchema.optional(),
	normalization: sceneNormalizationSchema.optional()
})

export type SceneLook = z.infer<typeof sceneLookSchema>

/*
  The other five sections are normalized on the server by rules that also
  read the model (camera ids, clip names, hotspot anchors), so the contract
  carries them as JSON and the server's answer is what was stored.
*/
const section = z.record(z.string(), z.unknown())

const sceneSettingsSections = {
	...sceneLookSchema.shape,
	camera: section.optional(),
	interactions: z.array(section).optional(),
	animation: section.optional(),
	presentation: section.optional(),
	hotspots: z.array(section).optional()
}

/** `GET` and `PATCH /api/v1/scenes/:sceneId/settings`: the scene's settings. */
export const sceneSettingsSchema = z.object({
	settings: z.object(sceneSettingsSections)
})

export type SceneSettingsDocument = z.infer<typeof sceneSettingsSchema>

/**
 * `PATCH /api/v1/scenes/:sceneId/settings`: the sections to change. Each one
 * sent replaces the stored section whole; those left out stay as they are.
 *
 * Only the sections a save changes alone. When the publisher changes the
 * camera, hotspots, interactions, animation or normalization, it also derives
 * other state from the loaded model: a marker's own camera, clips matched to
 * the model's, positions moved to a new scale. The server has no model to
 * derive from, so those sections are read-only here, and sending one is
 * refused rather than ignored.
 */
export const updateSceneSettingsInputSchema = z.strictObject({
	bounds: sceneBoundsSchema.optional(),
	controls: sceneControlsSchema.optional(),
	environment: sceneEnvironmentSchema.optional(),
	shadows: sceneShadowsSchema.optional(),
	// The viewer's chrome. `compressTexturesForGpu` is accepted so a section
	// read from `GET` can be sent back, and ignored: the publisher stores it
	// against the optimization preset, which the server does not decide.
	presentation: z
		.strictObject({
			showInfoPopover: z.boolean().optional(),
			showSceneViewReturn: z.boolean().optional(),
			showLoadingThumbnail: z.boolean().optional(),
			compressTexturesForGpu: z.boolean().optional()
		})
		.optional()
})

export type UpdateSceneSettingsInput = z.infer<
	typeof updateSceneSettingsInputSchema
>
