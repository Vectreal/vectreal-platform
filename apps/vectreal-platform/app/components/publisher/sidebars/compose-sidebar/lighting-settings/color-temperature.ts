/*
  A light's color, offered as a color temperature because that is how a
  photographer names a studio light's color. Stored as the hex the viewer
  reads, so a color picked another way still renders; the slider then shows
  the nearest temperature.

  Tanner Helland's fit of the blackbody locus to sRGB: 6600 K comes out pure
  white, which is the point a light adds no tint.
*/

export const MIN_KELVIN = 2000
export const MAX_KELVIN = 10000
export const NEUTRAL_KELVIN = 6600

const clampByte = (value: number) =>
	Math.round(Math.min(255, Math.max(0, value)))

const toHex = (channels: number[]) =>
	`#${channels.map((c) => clampByte(c).toString(16).padStart(2, '0')).join('')}`

export function kelvinToHex(kelvin: number): string {
	const t = kelvin / 100
	const red = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
	const green =
		t <= 66
			? 99.4708025861 * Math.log(t) - 161.1195681661
			: 288.1221695283 * Math.pow(t - 60, -0.0755148492)
	const blue =
		t >= 66
			? 255
			: t <= 19
				? 0
				: 138.5177312231 * Math.log(t - 10) - 305.0447927307
	return toHex([red, green, blue])
}

const channelsOf = (hex: string) =>
	[1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))

/** The temperature, in steps of 100 K, whose color is nearest `hex`. */
export function hexToKelvin(hex: string): number {
	const target = channelsOf(hex)
	let nearest = NEUTRAL_KELVIN
	let nearestDistance = Infinity
	for (let kelvin = MIN_KELVIN; kelvin <= MAX_KELVIN; kelvin += 100) {
		const distance = channelsOf(kelvinToHex(kelvin)).reduce(
			(sum, channel, i) => sum + (channel - target[i]) ** 2,
			0
		)
		if (distance < nearestDistance) {
			nearest = kelvin
			nearestDistance = distance
		}
	}
	return nearest
}
