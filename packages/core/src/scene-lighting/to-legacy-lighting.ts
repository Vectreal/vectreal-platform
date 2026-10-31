import {
	LEGACY_LIGHTING_DEFAULTS,
	LEGACY_MIN_REACH,
	resolveLighting
} from './resolve-lighting'

import type { EnvironmentProps, SceneSettings, ShadowsProps } from '../types'

const RADIANS = Math.PI / 180

/*
  Where every derived legacy light stands, in model radii: the old default,
  clear of the model and well inside the old bake's far plane (25 radii). Its
  size is carried by the jitter box width instead, which the migration reads
  back as the angle that box covers from here.
*/
const LEGACY_LIGHT_DISTANCE = Math.hypot(
	...LEGACY_LIGHTING_DEFAULTS.lightPosition
)

/* A light 180 degrees across would need an infinitely wide box. */
const LEGACY_MAX_SIZE = 170

/**
 * A scene's settings with the legacy `environment` and `shadows` a viewer
 * released before `lighting` reads, derived from its `lighting`. Everything
 * else passes through, the persisted shadow bake included. A scene without
 * `lighting` already has them and comes back as it is.
 *
 * Old viewers know one light, which shadows only the ground, and no rotation.
 * So the key (or the first light that is lit) gives the shadow its direction
 * and size, every lit light together its darkness, as the viewer's ground
 * bake does, and the environment shows unturned with the light where the map
 * holds it. Fill, rim and the light on the model are what an old viewer
 * misses. Removed with the deprecated viewer props in the next major.
 */
export function toLegacyLighting(settings: SceneSettings): SceneSettings {
	if (!settings.lighting) return settings
	const lighting = resolveLighting(settings)

	// Only light from above the horizon reaches the ground, in the viewer's
	// bake as in an old one.
	const lit = lighting.lights.filter(
		(light) => light.enabled && light.intensity > 0 && light.elevation > 0
	)
	const key = lit.find((light) => light.role === 'key') ?? lit[0]
	const strength = lit.reduce(
		(sum, light) =>
			sum +
			light.intensity *
				Math.max(Math.sin(light.elevation * RADIANS), LEGACY_MIN_REACH),
		0
	)

	const { background } = lighting
	const environment: EnvironmentProps = {
		preset: lighting.environment.map,
		environmentResolution: lighting.environment.resolution,
		environmentIntensity: lighting.environment.intensity,
		background: background.type === 'environment',
		...(background.type === 'environment'
			? {
					backgroundIntensity: background.intensity,
					backgroundBlurriness: background.blur
				}
			: {}),
		...(background.type === 'color' || background.type === 'gradient'
			? { backdrop: background }
			: {})
	}

	const shadows: ShadowsProps = {
		enabled: lighting.ground.enabled,
		opacity: 1,
		light: {
			// Ground every light is blocked from keeps this share of its light.
			ambient: 1 / (1 + strength),
			...(key ? legacyLight(key) : {})
		},
		ao: lighting.occlusion.mode === 'live',
		aoIntensity: lighting.occlusion.live.intensity,
		aoAtRest: lighting.occlusion.live.atRest,
		...(settings.shadows?.baked ? { baked: settings.shadows.baked } : {})
	}

	return { ...settings, environment, shadows }
}

/**
 * A legacy light that looks `size` degrees across from the model: at
 * {@link LEGACY_LIGHT_DISTANCE}, with a jitter box that wide from there.
 */
function legacyLight({
	azimuth,
	elevation,
	size
}: {
	azimuth: number
	elevation: number
	size: number
}): { position: [number, number, number]; radius: number } {
	const a = azimuth * RADIANS
	const e = elevation * RADIANS
	const d = LEGACY_LIGHT_DISTANCE
	return {
		position: [
			Math.sin(a) * Math.cos(e) * d,
			Math.sin(e) * d,
			Math.cos(a) * Math.cos(e) * d
		],
		radius: 2 * d * Math.tan((Math.min(size, LEGACY_MAX_SIZE) / 2) * RADIANS)
	}
}
