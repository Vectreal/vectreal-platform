import { useEnvironment } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Suspense, useEffect, useState } from 'react'
import {
	type Camera,
	type Texture,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	Scene,
	type WebGLRenderer
} from 'three'

import LoadFailureBoundary from '../load-failure-boundary'
import { forgetEnvironmentFiles } from './scene-environment'

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
 * drei's `<Environment>` disposes this same cached texture when it unmounts,
 * which drops the PMREM with it, so the prewarm runs again whenever that
 * happens and the next model finds it ready too.
 */
const PrewarmEnvironmentTexture = ({ files }: { files: string | string[] }) => {
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

/**
 * Prewarms the environment as soon as the viewer knows which one it will use,
 * before there is a model to light. With no files chosen yet it prewarms
 * nothing rather than a default.
 *
 * A failed prewarm only costs the head start: the scene's own environment
 * downloads the same file again and lights from its fallback if that fails
 * too, so the failure is forgotten here rather than left for it to reuse. The
 * boundary is keyed on the files so that a later environment is prewarmed
 * after an earlier one failed.
 */
const EnvironmentPrewarm = ({ files }: { files: string | string[] | null }) =>
	files ? (
		<LoadFailureBoundary
			key={String(files)}
			onError={() => forgetEnvironmentFiles(files)}
		>
			<Suspense fallback={null}>
				<PrewarmEnvironmentTexture files={files} />
			</Suspense>
		</LoadFailureBoundary>
	) : null

export default EnvironmentPrewarm
