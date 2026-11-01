import {
	DEFAULT_ENVIRONMENT_PRESET,
	resolveSceneBackdrop
} from '../scene-environment'

import type {
	AccumulativeShadowLight,
	EnvironmentProps,
	SceneBackdrop,
	SceneLight,
	SceneLightingBackground,
	SceneOcclusionSettings,
	SceneSettings,
	ShadowsProps
} from '../types'

/** A scene light with every field answered. */
export type ResolvedSceneLight = Required<SceneLight>

/** A scene's lighting with every field answered, as the viewer draws it. */
export interface ResolvedLighting {
	environment: {
		map: NonNullable<EnvironmentProps['preset']>
		resolution: NonNullable<EnvironmentProps['environmentResolution']>
		intensity: number
		rotation: number
	}
	lights: ResolvedSceneLight[]
	ground: { enabled: boolean }
	background: SceneLightingBackground
	occlusion: {
		mode: NonNullable<SceneOcclusionSettings['mode']>
		live: { intensity: number; atRest: boolean }
	}
	bake: { lights: boolean }
}

const DEFAULT_ENVIRONMENT: ResolvedLighting['environment'] = {
	map: DEFAULT_ENVIRONMENT_PRESET,
	resolution: '1k',
	intensity: 1,
	rotation: 0
}

const DEFAULT_LIGHT: Omit<ResolvedSceneLight, 'role'> = {
	enabled: true,
	azimuth: 45,
	elevation: 45,
	size: 20,
	intensity: 1,
	color: '#ffffff'
}

const DEFAULT_ENVIRONMENT_BACKGROUND = { intensity: 1, blur: 0.5 }

const DEFAULT_OCCLUSION_LIVE = { intensity: 1.4, atRest: false }

/*
  What the viewer filled in for a scene saved before `lighting`, when a field
  was absent. These are the values `defaultShadowsOptions` and
  `defaultEnvOptions` carry in the app and `scene-shadows.tsx` carries in the
  viewer; a migration that assumed anything else would move the shadow of
  every scene that never touched the field. The app's `viewer-defaults.spec.ts`
  holds the two copies together until both are deleted.
*/
export const LEGACY_LIGHTING_DEFAULTS = {
	shadowsEnabled: false,
	lightPosition: [0, 2.5, 0] as [number, number, number],
	lightRadius: 0.8,
	lightAmbient: 0.3,
	opacity: 0.9,
	ao: false,
	aoIntensity: 1.4,
	aoAtRest: false,
	environmentIntensity: 1,
	backgroundIntensity: 1,
	backgroundBlurriness: 0.5
}

/*
  The bake's ambient term is the share of its light that came from the whole
  sky rather than the light. The publisher never let it go below this.
*/
const LEGACY_MIN_AMBIENT = 0.05

/*
  The strongest key a migration gives. A legacy shadow's darkness came from a
  light that lit only the ground, so reading it straight across would light
  the model too: the darkest preset would ask for a key many times the whole
  environment and blow out the lit side of every shadowed scene. Capped, a
  migrated model gets at most twice its old diffuse light, and its darkest
  shadows come out lighter than they were.
*/
const MIGRATED_MAX_KEY_INTENSITY = 1

/*
  How much a legacy light at the horizon is taken to reach the ground, so its
  strength stays finite. `toLegacyLighting` floors it the same way, so a
  scene survives the round trip.
*/
export const LEGACY_MIN_REACH = 0.05

const degrees = (radians: number) => (radians * 180) / Math.PI

/**
 * `defaults` with every field of `value` that is set. A field present but
 * undefined, as an edit in progress can leave one, keeps its default, which a
 * spread would overwrite.
 */
function filled<T extends object>(defaults: T, value: Partial<T> = {}): T {
	const result = { ...defaults }
	for (const key of Object.keys(value) as Array<keyof T>) {
		if (value[key] !== undefined) result[key] = value[key] as T[keyof T]
	}
	return result
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

/**
 * How a scene is lit, with every field answered.
 *
 * The only reader of lighting: a scene saved with `lighting` gets its own
 * values over the defaults, and a scene saved before it is migrated from its
 * `environment` and `shadows`, so both shapes render through one path.
 */
export function resolveLighting(
	settings: Pick<SceneSettings, 'lighting' | 'environment' | 'shadows'> = {}
): ResolvedLighting {
	const { lighting } = settings
	if (!lighting) return migrateLegacyLighting(settings)

	return {
		environment: filled(DEFAULT_ENVIRONMENT, lighting.environment),
		lights: (lighting.lights ?? []).map(resolveLight),
		ground: { enabled: lighting.ground?.enabled ?? false },
		background: resolveBackground(lighting.background),
		occlusion: {
			mode: lighting.occlusion?.mode ?? 'off',
			live: filled(DEFAULT_OCCLUSION_LIVE, lighting.occlusion?.live)
		},
		bake: { lights: lighting.bake?.lights ?? false }
	}
}

function resolveLight(light: SceneLight): ResolvedSceneLight {
	const resolved = filled<ResolvedSceneLight>(
		{ ...DEFAULT_LIGHT, role: light.role },
		light
	)
	// Checked like a stage's colors: a publisher swatch paints it into a style.
	return HEX_COLOR.test(resolved.color)
		? resolved
		: { ...resolved, color: DEFAULT_LIGHT.color }
}

function resolveBackground(
	background: SceneLightingBackground = { type: 'none' }
): SceneLightingBackground {
	switch (background.type) {
		case 'environment':
			return filled(
				{ type: 'environment' as const, ...DEFAULT_ENVIRONMENT_BACKGROUND },
				background
			)
		case 'color':
		case 'gradient':
			return stageOrNone(background)
		case 'none':
			return background
	}
}

/*
  A stage's colors are written into the style of a viewer running inside
  customers' pages; `resolveSceneBackdrop` lets through `#rrggbb` hex and
  nothing else, for both shapes.
*/
const stageOrNone = (backdrop: SceneBackdrop): SceneLightingBackground =>
	resolveSceneBackdrop({ backdrop }) ?? { type: 'none' }

/**
 * The lighting a scene saved before `lighting` meant.
 *
 * Its shadow had a light of its own that lit nothing else. That light becomes
 * the key: its position gives the direction, its jitter the size, and the
 * shadow's darkness the strength, up to {@link MIGRATED_MAX_KEY_INTENSITY}.
 * The key now lights the model too, which is the change a migrated scene
 * shows. A scene whose shadows were off gets no light, and looks as it did.
 */
function migrateLegacyLighting({
	environment = {},
	shadows = {}
}: Pick<SceneSettings, 'environment' | 'shadows'>): ResolvedLighting {
	const D = LEGACY_LIGHTING_DEFAULTS
	const shadowsEnabled = shadows.enabled ?? D.shadowsEnabled

	return {
		environment: {
			map: environment.preset ?? DEFAULT_ENVIRONMENT.map,
			resolution:
				environment.environmentResolution ?? DEFAULT_ENVIRONMENT.resolution,
			intensity: environment.environmentIntensity ?? D.environmentIntensity,
			rotation: 0
		},
		lights: shadowsEnabled ? [migrateLegacyKey(shadows)] : [],
		ground: { enabled: shadowsEnabled },
		background: migrateLegacyBackground(environment),
		occlusion: {
			// The viewer drew it only while shadows were on.
			mode: shadowsEnabled && (shadows.ao ?? D.ao) ? 'live' : 'off',
			live: {
				intensity: shadows.aoIntensity ?? D.aoIntensity,
				atRest: shadows.aoAtRest ?? D.aoAtRest
			}
		},
		bake: { lights: false }
	}
}

function migrateLegacyKey({
	light = {},
	opacity
}: ShadowsProps): ResolvedSceneLight {
	const D = LEGACY_LIGHTING_DEFAULTS
	const [x, y, z] = (light.position ?? D.lightPosition) as [
		number,
		number,
		number
	]
	const horizontal = Math.hypot(x, z)
	const distance = Math.hypot(horizontal, y)
	const ambient = Math.min(
		Math.max(light.ambient ?? D.lightAmbient, LEGACY_MIN_AMBIENT),
		1
	)
	/*
	  The share of the ground's light the shadow took away: what the bake light
	  carried, as deep as Opacity drew it. Approximate, because the viewer
	  calibrated the drawn shadow against the plane it measured; close enough
	  that a lighter shadow migrates to a weaker key.
	*/
	const blocked = Math.min((1 - ambient) * (opacity ?? D.opacity), 0.99)
	/*
	  The jitter was a box `radius` wide around the light, in units of the
	  model's footprint, while the position was in units of its bounding
	  radius. The two are close for most models, so the half-width over the
	  distance gives the angle the light covered.
	*/
	const halfWidth = (light.radius ?? D.lightRadius) / 2
	const elevation = Math.atan2(y, horizontal)
	// A low light reaches the ground at a slant, so it takes more strength to
	// block as much.
	const reach = Math.max(Math.sin(elevation), LEGACY_MIN_REACH)

	return {
		...DEFAULT_LIGHT,
		role: 'key',
		// Straight overhead has no azimuth; atan2(0, 0) answers 0.
		azimuth: degrees(Math.atan2(x, z)),
		elevation: degrees(elevation),
		size: distance > 0 ? degrees(2 * Math.atan(halfWidth / distance)) : 0,
		// Ground the light cannot reach keeps
		// 1 / (1 + intensity * sin(elevation)) of its light.
		intensity: Math.min(
			blocked / (1 - blocked) / reach,
			MIGRATED_MAX_KEY_INTENSITY
		)
	}
}

/**
 * A legacy key light turned to point along `toward`, at the distance it
 * already had. The in-scene handle says only which way the light is, while
 * {@link resolveLighting} reads the distance as the light's size, so turning
 * the light must not change it.
 */
export function aimLegacyLight(
	position: AccumulativeShadowLight['position'],
	toward: [number, number, number]
): [number, number, number] {
	const distance = Math.hypot(
		...((position ?? LEGACY_LIGHTING_DEFAULTS.lightPosition) as number[])
	)
	const length = Math.hypot(...toward)
	return toward.map((axis) => (axis / length) * distance) as [
		number,
		number,
		number
	]
}

function migrateLegacyBackground(
	environment: EnvironmentProps
): SceneLightingBackground {
	const D = LEGACY_LIGHTING_DEFAULTS
	if (environment.background) {
		return {
			type: 'environment',
			intensity: environment.backgroundIntensity ?? D.backgroundIntensity,
			blur: environment.backgroundBlurriness ?? D.backgroundBlurriness
		}
	}
	return environment.backdrop
		? stageOrNone(environment.backdrop)
		: { type: 'none' }
}

/**
 * The direction a light stands in, read from a point along it: the in-scene
 * handle's position, in any units. Relative to the environment's `rotation`,
 * as a light's azimuth is stored, so the light stays put on the map when the
 * setup turns. A point below the horizon aims the light along it.
 */
export function aimLight(
	toward: [number, number, number],
	rotation: number
): { azimuth: number; elevation: number } {
	const [x, y, z] = toward
	const azimuth = degrees(Math.atan2(x, z)) - rotation
	return {
		// Kept in [-180, 180).
		azimuth: ((((azimuth + 180) % 360) + 360) % 360) - 180,
		elevation: degrees(Math.atan2(y, Math.hypot(x, z)))
	}
}
