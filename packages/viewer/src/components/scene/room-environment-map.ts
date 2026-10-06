import { useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { PMREMGenerator, type Texture } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * A neutral studio light built on the GPU from three's procedural room, for a
 * scene whose own environment map could not be downloaded. Lit materials read
 * almost black with no environment at all, and this needs no network.
 */
export const useRoomEnvironmentMap = (): null | Texture => {
	const gl = useThree((state) => state.gl)
	const [map, setMap] = useState<null | Texture>(null)

	useEffect(() => {
		const generator = new PMREMGenerator(gl)
		const room = new RoomEnvironment()
		const target = generator.fromScene(room, 0.04)
		room.dispose()
		generator.dispose()
		setMap(target.texture)

		return () => {
			setMap(null)
			target.dispose()
		}
	}, [gl])

	return map
}
