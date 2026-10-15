import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { PMREMGenerator, type Scene, type WebGLRenderer } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

import type { EnvironmentProps } from '@vctrl/core'

const buildRoomMap = (gl: WebGLRenderer) => {
	const generator = new PMREMGenerator(gl)
	const room = new RoomEnvironment()
	const map = generator.fromScene(room, 0.04)
	room.dispose()
	generator.dispose()
	return map
}

const resolveScene = (target: EnvironmentProps['scene'], fallback: Scene) =>
	(target && 'current' in target ? target.current : target) ?? fallback

/**
 * Lights a scene with three's procedural room, for a scene whose own
 * environment map could not be downloaded: lit materials read almost black
 * with no environment at all, and the room needs no network.
 *
 * Applied in a layout effect, so the environment is in place before the
 * viewer's shader warm-up, a passive effect, compiles against it. The room is
 * a render target rather than an image, so a lost context cannot re-upload
 * it; it is built again when the context is restored.
 */
export const useRoomEnvironment = (
	environmentIntensity: number,
	target: EnvironmentProps['scene']
) => {
	const gl = useThree((state) => state.gl)
	const defaultScene = useThree((state) => state.scene)
	const scene = resolveScene(target, defaultScene)

	useLayoutEffect(() => {
		const previous = scene.environment
		let map = buildRoomMap(gl)
		scene.environment = map.texture

		const rebuild = () => {
			map.dispose()
			map = buildRoomMap(gl)
			scene.environment = map.texture
		}
		gl.domElement.addEventListener('webglcontextrestored', rebuild)

		return () => {
			gl.domElement.removeEventListener('webglcontextrestored', rebuild)
			scene.environment = previous
			map.dispose()
		}
	}, [gl, scene])

	useLayoutEffect(() => {
		const previous = scene.environmentIntensity
		scene.environmentIntensity = environmentIntensity
		return () => {
			scene.environmentIntensity = previous
		}
	}, [scene, environmentIntensity])
}
