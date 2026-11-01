import {
	LIGHTING_SETUPS,
	resolveLighting,
	type LightingSettings,
	type LightingSetup,
	type SceneLight,
	type SceneLightingBackground,
	type SceneLightRole
} from '@vctrl/core'

/** The order lights are listed and stored in. */
export const LIGHT_ROLES: readonly SceneLightRole[] = ['key', 'fill', 'rim']

/*
  The parts of the lighting a setup decides. A setup is still the same setup
  turned, or at another resolution, so neither counts against a match. The
  background, ambient occlusion and what is baked are composition: a setup
  leaves them alone and matches with them changed. Picking a setup does set its own turn.
*/
const lookOf = (lighting: LightingSettings) => {
	const { environment, lights, ground } = resolveLighting({ lighting })
	return JSON.stringify({
		map: environment.map,
		intensity: environment.intensity,
		lights: [...lights].sort(
			(a, b) => LIGHT_ROLES.indexOf(a.role) - LIGHT_ROLES.indexOf(b.role)
		),
		ground
	})
}

/** The setup `lighting` is, or undefined once it has been edited away from one. */
export function matchingSetup(
	lighting: LightingSettings
): LightingSetup | undefined {
	const look = lookOf(lighting)
	return LIGHTING_SETUPS.find((setup) => lookOf(setup.lighting) === look)
}

/** `setup`'s look, keeping the author's resolution, background, occlusion and bake. */
export function withSetup(
	lighting: LightingSettings,
	setup: LightingSetup
): LightingSettings {
	return {
		...setup.lighting,
		environment: {
			...setup.lighting.environment,
			resolution: lighting.environment?.resolution
		},
		background: lighting.background ?? setup.lighting.background,
		occlusion: lighting.occlusion,
		bake: lighting.bake
	}
}

/** The lighting with the light of `role` changed by `change`. */
export function withLight(
	lighting: LightingSettings,
	role: SceneLightRole,
	change: Partial<Omit<SceneLight, 'role'>>
): LightingSettings {
	return {
		...lighting,
		lights: (lighting.lights ?? []).map((light) =>
			light.role === role ? { ...light, ...change } : light
		)
	}
}

/*
  Where a new light starts, relative to the key so it lands where that role
  belongs: a broad, dim fill across from it, and a small, bright rim behind
  the model.
*/
const NEW_LIGHT: Record<
	SceneLightRole,
	Omit<SceneLight, 'role' | 'azimuth'> & { offset: number }
> = {
	key: { offset: 0, elevation: 45, size: 20, intensity: 1 },
	fill: { offset: -110, elevation: 25, size: 60, intensity: 0.3 },
	rim: { offset: 160, elevation: 35, size: 15, intensity: 0.8 }
}

const DEFAULT_KEY_AZIMUTH = 45

/** Wraps degrees into [-180, 180). */
export const wrapDegrees = (degrees: number) =>
	((((degrees + 180) % 360) + 360) % 360) - 180

/** The lighting with a light of `role` added, unless it has one already. */
export function withLightAdded(
	lighting: LightingSettings,
	role: SceneLightRole
): LightingSettings {
	const lights = lighting.lights ?? []
	if (lights.some((light) => light.role === role)) return lighting

	const keyAzimuth =
		lights.find((light) => light.role === 'key')?.azimuth ?? DEFAULT_KEY_AZIMUTH
	const { offset, ...light } = NEW_LIGHT[role]
	const added: SceneLight = {
		role,
		...light,
		azimuth: wrapDegrees(keyAzimuth + offset)
	}

	return {
		...lighting,
		lights: [...lights, added].sort(
			(a, b) => LIGHT_ROLES.indexOf(a.role) - LIGHT_ROLES.indexOf(b.role)
		)
	}
}

/** The lighting without its light of `role`. */
export function withLightRemoved(
	lighting: LightingSettings,
	role: SceneLightRole
): LightingSettings {
	return {
		...lighting,
		lights: (lighting.lights ?? []).filter((light) => light.role !== role)
	}
}

export type BackgroundType = SceneLightingBackground['type']

/** A light, neutral stage: a shadow reads on it without the stage competing. */
export const DEFAULT_STAGE_COLOR = '#f4f4f5'
export const DEFAULT_STAGE_GRADIENT = {
	top: '#fafafa',
	bottom: '#d4d4d8'
} as const

/**
 * The background of `type`: `previous` when it was that type already, so
 * switching back restores a stage the author picked, otherwise the default.
 */
export function backgroundOfType(
	type: BackgroundType,
	previous: SceneLightingBackground | undefined
): SceneLightingBackground {
	if (previous?.type === type) return previous
	switch (type) {
		case 'environment':
			return { type }
		case 'color':
			return { type, color: DEFAULT_STAGE_COLOR }
		case 'gradient':
			return { type, ...DEFAULT_STAGE_GRADIENT }
		case 'none':
			return { type }
	}
}

/**
 * `prev` with studio finish's parts switched. Depth is baked occlusion, and
 * switching it off hands the occlusion back to live, the nearest thing to
 * what was baked: the one place the mode moves between live and baked.
 */
export function withFinish(
	prev: LightingSettings,
	finish: { depth?: boolean; lights?: boolean }
): LightingSettings {
	return {
		...prev,
		...(finish.depth !== undefined && {
			occlusion: { ...prev.occlusion, mode: finish.depth ? 'baked' : 'live' }
		}),
		...(finish.lights !== undefined && {
			bake: { ...prev.bake, lights: finish.lights }
		})
	}
}
