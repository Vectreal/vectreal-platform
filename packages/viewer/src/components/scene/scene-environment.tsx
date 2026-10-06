import { Environment, useEnvironment } from '@react-three/drei'
import {
	DEFAULT_ENVIRONMENT_PRESET,
	EnvironmentProps,
	resolveEnvironmentFiles
} from '@vctrl/core'
import { memo } from 'react'

import LoadFailureBoundary from '../load-failure-boundary'
import { useRoomEnvironment } from './room-environment'

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
 * Drops a failed map from the loader cache, which otherwise keeps the failure
 * and throws it for that file for the rest of the page's life.
 */
const forgetEnvironmentFiles = (files: string | string[]) => {
	try {
		useEnvironment.clear({ files })
	} catch {
		return
	}
}

/** Lights the scene, without a backdrop, while its own map is unavailable. */
const FallbackEnvironment = ({
	environmentIntensity,
	scene
}: {
	environmentIntensity: number
	scene: EnvironmentProps['scene']
}) => {
	useRoomEnvironment(environmentIntensity, scene)
	return null
}

/**
 * Sets up the environment for a scene.
 *
 * A map that fails to download is an extra gone missing, not a broken scene:
 * the scene is lit by a local room instead, from the same render that caught
 * the failure, so the shader warm-up compiles against the environment the
 * scene is shown with either way. The failure is forgotten, so the map is
 * downloaded again the next time it is shown, but not while it is on screen.
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
	const files = resolveEnvironmentFiles(environment)

	return (
		<LoadFailureBoundary
			key={String(files)}
			onError={() => forgetEnvironmentFiles(files)}
			fallback={
				<FallbackEnvironment
					environmentIntensity={environmentIntensity}
					scene={scene}
				/>
			}
		>
			<Environment
				files={files}
				background={background}
				backgroundBlurriness={backgroundBlurriness}
				backgroundIntensity={backgroundIntensity}
				environmentIntensity={environmentIntensity}
				scene={scene}
			/>
		</LoadFailureBoundary>
	)
})

export default SceneEnvironment
