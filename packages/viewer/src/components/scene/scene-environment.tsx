import { Environment, useEnvironment } from '@react-three/drei'
import {
	DEFAULT_ENVIRONMENT_PRESET,
	EnvironmentProps,
	resolveEnvironmentFiles
} from '@vctrl/core'
import { memo, useState } from 'react'

import LoadFailureBoundary from '../load-failure-boundary'
import { useRoomEnvironmentMap } from './room-environment-map'

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

/** Lights the scene, without a backdrop, while its own map is unavailable. */
const FallbackEnvironment = ({
	environmentIntensity,
	scene
}: Pick<EnvironmentProps, 'environmentIntensity' | 'scene'>) => {
	const map = useRoomEnvironmentMap()

	return map ? (
		<Environment
			map={map}
			environmentIntensity={environmentIntensity}
			scene={scene}
		/>
	) : null
}

/**
 * Sets up the environment for a scene.
 *
 * A map that fails to download is an extra gone missing, not a broken scene:
 * the scene is lit by a local room instead, and a different map is tried
 * afresh. The load still suspends the viewer's content, so the shader warm-up
 * compiles against the environment the scene is shown with.
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
	const filesKey = String(files)
	const [failedFilesKey, setFailedFilesKey] = useState<null | string>(null)

	if (failedFilesKey === filesKey) {
		return (
			<FallbackEnvironment
				environmentIntensity={environmentIntensity}
				scene={scene}
			/>
		)
	}

	return (
		<LoadFailureBoundary onError={() => setFailedFilesKey(filesKey)}>
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
