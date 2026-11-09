import {
	ENVIRONMENT_IRRADIANCE,
	environmentIrradiance,
	lightDirection,
	type EnvironmentKey
} from '@vctrl/core'

import type { JitterSource } from './shadow-light-jitter'
import type { ResolvedSceneLight } from '@vctrl/core'
import type { Texture } from 'three'

export { environmentIrradiance, lightDirection, litLights } from '@vctrl/core'
/**
 * How far from the model's center the lights stand, in multiples of its
 * bounding radius. Far enough to clear any model; a light's apparent size
 * is set by its `size`, not by this distance.
 */
export const LIGHT_DISTANCE_FACTOR = 2.5

const RADIANS = Math.PI / 180

/** What the ground bake reads of a light. */
export type GroundBakeLight = Pick<
	ResolvedSceneLight,
	'azimuth' | 'elevation' | 'size' | 'intensity'
>

/**
 * What the ground bake reads of each light, and nothing else, so a key built
 * from it re-bakes only when the shadow would change: not for a new color.
 */
export const groundBakeInputs = (
	lights: ReadonlyArray<ResolvedSceneLight>
): GroundBakeLight[] =>
	lights.map(({ azimuth, elevation, size, intensity }) => ({
		azimuth,
		elevation,
		size,
		intensity
	}))

/**
 * The light a scene's environment map delivers to an up-facing surface:
 * measured from its pixels when it has them, as an HDR does, and otherwise,
 * for a hosted `map`, the figure measured from its HDR. A compressed map
 * decodes on the GPU with nothing to read, and its lights stay as bright as
 * the HDR's. Null for a map of the scene's own with no pixels.
 */
export function sceneIrradiance(
	texture: Texture | null,
	map: EnvironmentKey | null
): number | null {
	return (
		environmentIrradiance(texture) ?? (map ? ENVIRONMENT_IRRADIANCE[map] : null)
	)
}

/** The PCF filter's widest useful radius, in shadow-map texels. */
const MAX_SHADOW_RADIUS = 8

/** The light size, in degrees, at and past which the filter is widest. */
const SOFTEST_LIGHT_SIZE = 45

/**
 * The PCF filter radius, in shadow-map texels, for a light `size` degrees
 * across. The filter blurs a fixed few texels everywhere, so it cannot widen
 * a penumbra with distance the way a real area light does; this spreads light
 * sizes over the range it has, so a larger light reads softer on the model.
 * The ground's shadow is baked from the true size.
 */
export function shadowFilterRadius(size: number): number {
	const share = Math.min(Math.max(size / SOFTEST_LIGHT_SIZE, 0), 1)
	return 1 + (MAX_SHADOW_RADIUS - 1) * share
}

/**
 * What the ground bake samples: every lit light (see {@link litLights}),
 * jittered over a box as wide as the light appears from the model and
 * weighted by its strength, and, with probability `ambient`, the
 * environment's hemisphere.
 *
 * `blockedShare` is what ground every light is blocked from keeps of the
 * light open ground gets: `1 / (1 + sum of strength * sin(elevation))`, the
 * environment against the lights as they reach the ground. That is what a
 * light's strength means, so the model's lighting and this shadow agree.
 *
 * The bake plane is Lambertian and the hemisphere samples are uniform over
 * solid angle, so one delivers half what a light sample overhead does; the
 * hemisphere draws twice its share of samples to make up for it.
 */
export function groundBakeSources(
	lights: ReadonlyArray<GroundBakeLight>,
	rotation: number,
	modelRadius: number
): {
	sources: JitterSource[]
	ambient: number
	blockedShare: number
	distance: number
} {
	const distance = LIGHT_DISTANCE_FACTOR * modelRadius
	const strength = lights.reduce((sum, light) => sum + light.intensity, 0)
	const onGround = lights.reduce(
		(sum, light) =>
			sum + light.intensity * Math.max(Math.sin(light.elevation * RADIANS), 0),
		0
	)
	return {
		sources: lights.map((light) => ({
			position: lightDirection(light, rotation).map(
				(axis) => axis * distance
			) as [number, number, number],
			radius: 2 * Math.tan((light.size * RADIANS) / 2) * distance,
			weight: light.intensity
		})),
		ambient: 2 / (2 + strength),
		blockedShare: 1 / (1 + onGround),
		distance
	}
}
