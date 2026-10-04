import { Environment, useEnvironment } from '@react-three/drei'
import {
	DEFAULT_ENVIRONMENT_PRESET,
	EnvironmentProps,
	resolveEnvironmentFiles
} from '@vctrl/core'
import { memo } from 'react'

export const defaultEnvOptions = {
	preset: DEFAULT_ENVIRONMENT_PRESET,
	background: false,
	backgroundIntensity: 1,
	environmentIntensity: 1,
	environmentResolution: '1k',
	backgroundBlurriness: 0.5
} satisfies EnvironmentProps

/**
 * Starts downloading and decoding a scene's environment map before the scene
 * mounts, into the same loader cache `SceneEnvironment` reads from.
 *
 * The map is otherwise requested only once the model has loaded and the
 * scene renders, which put a multi-megabyte fetch and its decode in series
 * after the model's.
 *
 * drei refuses to preload some maps the scene itself loads fine, gainmaps
 * among them, by throwing. Those are simply not prefetched.
 */
export const preloadEnvironmentFiles = (files: string | string[]) => {
	try {
		useEnvironment.preload({ files })
	} catch {
		return
	}
}

/**
 * SceneEnvironment component that sets up the environment for a scene.
 */
const SceneEnvironment = memo((props: EnvironmentProps) => {
	const environment = { ...defaultEnvOptions, ...props }
	const {
		background,
		backgroundBlurriness,
		backgroundIntensity,
		environmentIntensity,
		scene
	} = environment

	return (
		<Environment
			files={resolveEnvironmentFiles(environment)}
			background={background}
			backgroundBlurriness={backgroundBlurriness}
			backgroundIntensity={backgroundIntensity}
			environmentIntensity={environmentIntensity}
			scene={scene}
		/>
	)
})

export default SceneEnvironment
