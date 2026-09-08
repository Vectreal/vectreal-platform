import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { VectrealViewer } from '@vctrl/viewer'
import { useRef } from 'react'

import type { Mesh } from 'three'

/**
 * A rounded cube in matte chrome, rendered by the real viewer.
 *
 * The docs index had no imagery, and every generic answer to that - an
 * illustration, a gradient, a stock render - is on the list of things that make
 * a page read as machine-made. This is the actual `@vctrl/viewer` the rows
 * beside it teach you to install, lighting a real material in a real scene, and
 * the reader can drag it.
 *
 * Geometry rather than a model file, deliberately. A GLB would be the more
 * honest subject, and it also costs a network request and a parse on a page
 * whose job is to route people to documentation; `RoundedBox` is generated in
 * the browser and weighs nothing.
 *
 * Worth stating plainly: an abstract spinning shape sits closer to the
 * "decorative 3D" tell than a real product model would. What keeps it on the
 * right side of that line is that it is the product doing the rendering and the
 * reader can interact with it - not a picture of a viewer, the viewer.
 */
function ChromeCube() {
	const meshRef = useRef<Mesh>(null)

	/*
	  Rotation is skipped outright under `prefers-reduced-motion`, rather than
	  slowed. The CSS block in `globals.css` cannot reach a render loop, so the
	  guard has to live here.
	*/
	const prefersReducedMotion =
		typeof window !== 'undefined' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches

	useFrame((_, delta) => {
		if (prefersReducedMotion || !meshRef.current) return
		meshRef.current.rotation.y += delta * 0.25
		meshRef.current.rotation.x += delta * 0.08
	})

	return (
		<RoundedBox
			ref={meshRef}
			args={[1.4, 1.4, 1.4]}
			radius={0.22}
			smoothness={8}
		>
			{/* Matte chrome: fully metallic, but rough enough to scatter rather than mirror. */}
			<meshStandardMaterial metalness={1} roughness={0.38} color="#c8c8c8" />
		</RoundedBox>
	)
}

export default function DocsScenePreviewClient() {
	return (
		<VectrealViewer
			className="h-full w-full"
			envOptions={{ preset: 'studio-key' }}
			shadowsOptions={{ enabled: false }}
			boundsOptions={{ margin: 1.4 }}
		>
			<ChromeCube />
		</VectrealViewer>
	)
}
