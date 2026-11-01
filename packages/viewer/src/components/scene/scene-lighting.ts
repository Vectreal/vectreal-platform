import { lightDirection } from '@vctrl/core'
import { DataUtils, HalfFloatType, type Texture } from 'three'

import type { JitterSource } from './shadow-light-jitter'
import type { ResolvedSceneLight } from '@vctrl/core'

export { lightDirection, litLights } from '@vctrl/core'
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

// Rec. 709 luminance, the weights three.js uses for linear color.
const luminance = (r: number, g: number, b: number) =>
	0.2126 * r + 0.7152 * g + 0.0722 * b

/** Pixels sampled per row at most; an environment map is low-frequency. */
const IRRADIANCE_SAMPLES_PER_ROW = 256

/**
 * The light an environment map delivers to an up-facing surface: radiance
 * integrated over the upper hemisphere, weighted by the cosine to the
 * vertical. Its luminance, in the units three.js uses for both an
 * environment's diffuse light (`getIBLIrradiance` is PI times the
 * cosine-weighted radiance) and a directional light's `intensity`, so a light
 * set to this much is as bright as the environment.
 *
 * Reads an equirectangular map's pixels in the row order its `flipY` says:
 * top row first when set, as the HDR loader stores them, bottom row first
 * when not, as the EXR loader does. Null for a map without pixels to read.
 */
export function environmentIrradiance(texture: Texture | null): number | null {
	const image = texture?.image as
		{ data?: ArrayLike<number>; width?: number; height?: number } | undefined
	const { data, width, height } = image ?? {}
	if (!data || !width || !height) return null
	const channels = data.length / (width * height)
	if (channels < 3) return null
	const read =
		texture?.type === HalfFloatType
			? (index: number) => DataUtils.fromHalfFloat(data[index])
			: (index: number) => data[index]

	const step = Math.max(1, Math.floor(width / IRRADIANCE_SAMPLES_PER_ROW))
	const pixelAzimuth = ((2 * Math.PI) / width) * step
	const pixelPolar = Math.PI / height
	let irradiance = 0
	for (let row = 0; row < height / 2; row++) {
		const polar = (row + 0.5) * pixelPolar
		const stored = texture?.flipY ? row : height - 1 - row
		// cos(polar) projects onto the vertical, sin(polar) is the row's share
		// of the sphere.
		const weight = Math.cos(polar) * Math.sin(polar) * pixelPolar * pixelAzimuth
		for (let column = 0; column < width; column += step) {
			const index = (stored * width + column) * channels
			irradiance +=
				weight * luminance(read(index), read(index + 1), read(index + 2))
		}
	}
	return irradiance
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
