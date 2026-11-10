import { formatFileSize } from '@shared/utils'
import {
	ENVIRONMENT_MAP_BYTES,
	type EnvironmentQuality,
	type ResolvedLighting
} from '@vctrl/core'

/*
  The time from asking for an environment map to the first frame it lights,
  on a slow phone: a Pixel 6a profile at 4x CPU slowdown on Lighthouse's Slow
  4G, measured for the HDR, the gzipped HDR and the gain map JPEG of two maps.
  All six fell on this line within 0.02 s.
*/
const SLOW_PHONE_LATENCY_SECONDS = 0.67
const SLOW_PHONE_BYTES_PER_SECOND = 184 * 1024

const slowPhoneSeconds = (bytes: number) =>
	Math.round(SLOW_PHONE_LATENCY_SECONDS + bytes / SLOW_PHONE_BYTES_PER_SECOND)

const inAbout = (seconds: number) =>
	seconds <= 1 ? 'about a second' : `about ${seconds} seconds`

export interface EnvironmentQualityChoice {
	/** Whether the map has a compressed version to choose. */
	canCompress: boolean
	/** What each quality downloads, when the map is a hosted one. */
	bytes: Record<EnvironmentQuality, number | null>
	/** Why the choice is what it is, for the setting's caption. */
	caption: string
}

/**
 * What the Quality setting offers for the map a scene uses: both sizes and
 * why the smaller one is worth it, or that the map loads lossless regardless.
 * A scene's own `files` have no compressed version and no known size.
 */
export function environmentQualityChoice(
	environment: Pick<ResolvedLighting['environment'], 'map' | 'resolution'>,
	hasOwnFiles: boolean
): EnvironmentQualityChoice {
	const sizes = hasOwnFiles
		? null
		: ENVIRONMENT_MAP_BYTES[environment.map][environment.resolution]
	if (sizes?.compressed == null) {
		return {
			canCompress: false,
			bytes: { compressed: null, lossless: sizes?.lossless ?? null },
			caption: 'This map has no compressed version, so it loads lossless.'
		}
	}

	const { lossless, compressed } = sizes
	return {
		canCompress: true,
		bytes: { compressed, lossless },
		caption:
			`Compressed is about ${Math.round(lossless / compressed)}x smaller, so ` +
			`the lighting shows in ${inAbout(slowPhoneSeconds(compressed))} on a ` +
			`slow phone connection, instead of ${slowPhoneSeconds(lossless)}.`
	}
}

/** A quality's toggle label, with what it downloads when that is known. */
export const qualityLabel = (
	quality: EnvironmentQuality,
	bytes: number | null
) => {
	const name = quality === 'compressed' ? 'Compressed' : 'Lossless'
	return bytes === null ? name : `${name} ${formatFileSize(bytes)}`
}
