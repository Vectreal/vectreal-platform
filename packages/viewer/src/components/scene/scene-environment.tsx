import { Environment, useEnvironment } from '@react-three/drei'
import {
	DEFAULT_ENVIRONMENT_PRESET,
	EnvironmentProps,
	resolveEnvironmentFiles
} from '@vctrl/core'
import { memo, useEffect, useMemo, useRef } from 'react'
import { Euler } from 'three'

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
export const forgetEnvironmentFiles = (files: string | string[]) => {
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

interface SceneEnvironmentProps extends EnvironmentProps {
	/**
	 * Degrees around the vertical axis. Turns the map's light, its reflections
	 * and, when it is the background, the background together.
	 */
	rotation?: number
	/** Called with the map's files when they fail to load. */
	onLoadFailed?: (files: string[]) => void
	/** Called with the map's files once they light the scene. */
	onLoaded?: (files: string[]) => void
}

/**
 * Committed only beside a map that rendered: a map that throws or is still
 * loading keeps everything in its boundary from committing.
 */
const LoadedSignal = ({ onLoaded }: { onLoaded: () => void }) => {
	const onLoadedRef = useRef(onLoaded)
	onLoadedRef.current = onLoaded
	// Once each time the map is shown: the boundary around it is keyed by the
	// map's files, so another map or a remount mounts a new signal. The ref is
	// for StrictMode, which runs a mount effect twice in development.
	const signalled = useRef(false)
	useEffect(() => {
		if (signalled.current) return
		signalled.current = true
		onLoadedRef.current()
	}, [])
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
 * `onLoadFailed` and `onLoaded` are the only word of either that leaves the
 * canvas.
 */
const SceneEnvironment = memo(
	({
		onLoadFailed,
		onLoaded,
		rotation = 0,
		...props
	}: SceneEnvironmentProps) => {
		const environment = { ...defaultEnvOptions, ...props }
		const euler = useMemo(
			() => new Euler(0, (rotation * Math.PI) / 180, 0),
			[rotation]
		)
		const {
			background,
			backgroundBlurriness,
			backgroundIntensity,
			environmentIntensity,
			scene
		} = environment
		const files = resolveEnvironmentFiles(environment)
		const fileList = Array.isArray(files) ? files : [files]

		return (
			<LoadFailureBoundary
				key={String(files)}
				onError={() => {
					forgetEnvironmentFiles(files)
					onLoadFailed?.(fileList)
				}}
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
					environmentRotation={euler}
					backgroundRotation={euler}
					scene={scene}
				/>
				<LoadedSignal onLoaded={() => onLoaded?.(fileList)} />
			</LoadFailureBoundary>
		)
	}
)

export default SceneEnvironment
