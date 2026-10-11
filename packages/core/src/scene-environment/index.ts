import type {
	EnvironmentKey,
	EnvironmentProps,
	EnvironmentType,
	SceneBackdrop
} from '../types'

/** The environment a scene is lit by when it names none. */
export const DEFAULT_ENVIRONMENT_PRESET: EnvironmentKey = 'studio-natural'

const ENVIRONMENT_MAP_ROOT = 'https://storage.googleapis.com/environment-maps'

/**
 * The file a scene's environment loads: its own `files` when given, otherwise
 * the hosted HDR for its preset and resolution.
 *
 * One function for every reader, because the viewer fetching this file and a
 * page that preloads it have to agree on the URL to the character: a preload
 * for any other spelling is downloaded and then thrown away.
 */
export function resolveEnvironmentFiles(
	environment: Pick<
		EnvironmentProps,
		'preset' | 'environmentResolution' | 'files'
	> = {}
): string | string[] {
	if (environment.files) return environment.files

	const preset = environment.preset ?? DEFAULT_ENVIRONMENT_PRESET
	const type = preset.split('-')[0] as EnvironmentType
	const resolution = environment.environmentResolution ?? '1k'
	return `${ENVIRONMENT_MAP_ROOT}/${type}/${preset.replaceAll('-', '_')}_${resolution}.hdr`
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
