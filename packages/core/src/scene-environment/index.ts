import { ENVIRONMENT_MAP_BYTES } from './environment-map-bytes'

export { ENVIRONMENT_MAP_BYTES }

import type {
	EnvironmentKey,
	EnvironmentProps,
	EnvironmentQuality,
	EnvironmentType,
	SceneBackdrop
} from '../types'

/** Every hosted environment map, in the order a picker lists them. */
export const ENVIRONMENT_KEYS = [
	'studio-soft',
	'studio-key',
	'studio-natural',
	'outdoor-noon',
	'outdoor-golden-hour',
	'outdoor-overcast',
	'outdoor-sky',
	'nature-park',
	'nature-park-overcast',
	'nature-snow',
	'nature-moonlit',
	'night-city',
	'night-building',
	'night-pure-sky',
	'night-stars'
] as const satisfies readonly EnvironmentKey[]

// A key missing from the list fails to compile here.
type MissingEnvironmentKey = Exclude<
	EnvironmentKey,
	(typeof ENVIRONMENT_KEYS)[number]
>
const everyEnvironmentKey: [MissingEnvironmentKey] extends [never]
	? true
	: MissingEnvironmentKey = true
void everyEnvironmentKey

/** The environment a scene is lit by when it names none. */
export const DEFAULT_ENVIRONMENT_PRESET: EnvironmentKey = 'studio-natural'

/** Where every hosted environment map lives. */
export const ENVIRONMENT_MAP_ROOT =
	'https://storage.googleapis.com/environment-maps'

/*
  Maps whose gain map encoding is visibly off, so they have no compressed
  version. Their small, colored lights (city windows, street lamps, a low
  moon) are smeared by the gain map's 4:2:0 chroma subsampling, which tints
  the background; no encoder setting fixed it.
*/
const LOSSLESS_ONLY: ReadonlySet<EnvironmentKey> = new Set<EnvironmentKey>([
	'nature-moonlit',
	'night-city',
	'night-building'
])

/** Whether a hosted map has a compressed version to load. */
export function hasCompressedEnvironment(preset: EnvironmentKey): boolean {
	return !LOSSLESS_ONLY.has(preset)
}

/** The hosted maps that have a compressed version, in picker order. */
export const COMPRESSED_ENVIRONMENT_KEYS = ENVIRONMENT_KEYS.filter(
	hasCompressedEnvironment
)

type HostedEnvironment = Pick<
	EnvironmentProps,
	'preset' | 'environmentResolution' | 'environmentQuality' | 'files'
>

/**
 * The encoding a scene's environment actually loads: what it asks for, unless
 * it asks for a compressed version its map does not have. Null for a scene's
 * own `files`, which are loaded as they are.
 */
export function loadedEnvironmentQuality(
	environment: HostedEnvironment = {}
): EnvironmentQuality | null {
	if (environment.files) return null
	const preset = environment.preset ?? DEFAULT_ENVIRONMENT_PRESET
	return environment.environmentQuality === 'compressed' &&
		hasCompressedEnvironment(preset)
		? 'compressed'
		: 'lossless'
}

/**
 * The file a scene's environment loads: its own `files` when given, otherwise
 * the hosted map for its preset, resolution and quality. Absent quality is
 * lossless, the HDR.
 *
 * One function for every reader, because the viewer fetching this file and a
 * page that preloads it have to agree on the URL to the character: a preload
 * for any other spelling is downloaded and then thrown away.
 */
export function resolveEnvironmentFiles(
	environment: HostedEnvironment = {}
): string | string[] {
	if (environment.files) return environment.files

	const preset = environment.preset ?? DEFAULT_ENVIRONMENT_PRESET
	const type = preset.split('-')[0] as EnvironmentType
	const resolution = environment.environmentResolution ?? '1k'
	const extension =
		loadedEnvironmentQuality(environment) === 'compressed' ? 'jpg' : 'hdr'
	return `${ENVIRONMENT_MAP_ROOT}/${type}/${preset.replaceAll('-', '_')}_${resolution}.${extension}`
}

/**
 * What a visitor downloads for a scene's environment map, in bytes on the
 * wire, or null for a scene's own `files`, whose size is not known here.
 */
export function environmentMapBytes(
	environment: HostedEnvironment = {}
): number | null {
	const quality = loadedEnvironmentQuality(environment)
	if (quality === null) return null
	const preset = environment.preset ?? DEFAULT_ENVIRONMENT_PRESET
	const sizes =
		ENVIRONMENT_MAP_BYTES[preset][environment.environmentResolution ?? '1k']
	return quality === 'compressed' ? sizes.compressed : sizes.lossless
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

/**
 * The backdrop a scene's viewer paints behind the model, or null for none.
 *
 * Shown only while the environment map is not the background, since the map
 * covers the whole view when it is. Anything but `#rrggbb` hex is refused:
 * the value is written into the style of a viewer that runs inside customers'
 * pages, so it may name a color and nothing else.
 */
export function resolveSceneBackdrop(
	environment: Pick<EnvironmentProps, 'background' | 'backdrop'> = {}
): SceneBackdrop | null {
	const { background, backdrop } = environment
	if (background || !backdrop) return null
	if (backdrop.type === 'color')
		return HEX_COLOR.test(backdrop.color) ? backdrop : null
	if (backdrop.type === 'gradient')
		return HEX_COLOR.test(backdrop.top) && HEX_COLOR.test(backdrop.bottom)
			? backdrop
			: null
	return null
}

/** The CSS `background` that paints a backdrop. */
export function sceneBackdropCss(backdrop: SceneBackdrop): string {
	return backdrop.type === 'color'
		? backdrop.color
		: `linear-gradient(to bottom, ${backdrop.top}, ${backdrop.bottom})`
}
