import { useEnvironment } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import {
	type Camera,
	type Texture,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	Scene,
	type WebGLRenderer
} from 'three'

/**
 * Builds the PMREM three needs to light a scene with `texture`, by compiling a
 * throwaway scene that samples it.
 *
 * three generates it synchronously the first time a lit material reads
 * `scene.environment`, and caches it against the texture. Done here, that
 * happens while the model is still downloading; otherwise it lands inside the
 * model's own warm-up compile, after the download, on the main thread.
 */
export const prewarmEnvironment = (
	gl: Pick<WebGLRenderer, 'compile'>,
	camera: Camera,
	texture: Texture
) => {
	const scene = new Scene()
	const geometry = new PlaneGeometry()
	const material = new MeshStandardMaterial()
	scene.environment = texture
	scene.add(new Mesh(geometry, material))
	try {
		gl.compile(scene, camera)
	} finally {
		geometry.dispose()
		material.dispose()
	}
}

/**
 * Prewarms the environment as soon as the viewer knows which one it will use,
 * before there is a model to light.
 *
 * drei's `<Environment>` disposes this same cached texture when it unmounts,
 * which drops the PMREM with it, so the prewarm runs again whenever that
 * happens and the next model finds it ready too.
 */
const EnvironmentPrewarm = ({ files }: { files: string | string[] }) => {
	const texture = useEnvironment({ files })
	const gl = useThree((state) => state.gl)
	const camera = useThree((state) => state.camera)
	const [disposals, setDisposals] = useState(0)

	useEffect(() => {
		prewarmEnvironment(gl, camera, texture)
		const onDispose = () => setDisposals((count) => count + 1)
		texture.addEventListener('dispose', onDispose)
		return () => texture.removeEventListener('dispose', onDispose)
	}, [gl, camera, texture, disposals])

	return null
}

export default EnvironmentPrewarm
