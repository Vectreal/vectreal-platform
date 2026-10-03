import type {
	EnvironmentKey,
	EnvironmentProps,
	EnvironmentType
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
