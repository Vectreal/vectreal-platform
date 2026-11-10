import { DataUtils, HalfFloatType, type Texture } from 'three'

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
