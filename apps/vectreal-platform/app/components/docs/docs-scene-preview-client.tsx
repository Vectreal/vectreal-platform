import { Center, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { VectrealViewer } from '@vctrl/viewer'
import { useRef } from 'react'

import rocketUrl from '../../assets/models/rocket-balanced.glb?url'

import type { Group } from 'three'

/**
 * The rocket sample, rendered by the real viewer.
 *
 * The docs index had no imagery, and every generic answer to that - an
 * illustration, a gradient, a stock render - is on the list of things that make
 * a page read as machine-made. This is the actual `@vctrl/viewer` the rows
 * beside it teach you to install, rendering a real model, and the reader can
 * drag it.
 *
 * It was a generated chrome cube, chosen to spare the page a model download,
 * and an abstract spinning shape is the decorative-3D tell with a viewer behind
 * it. The rocket is the product's own sample, put through the publisher's
 * Balanced preset (`rocket-v3.glb`, 966,224 bytes, to 121,540 with Draco and
 * 1024px WebP), so the download is small and is itself what the docs describe.
 */
function Rocket() {
	const ref = useRef<Group>(null)
	// Draco-compressed, decoded by the copy the app serves rather than a CDN's.
	const { scene } = useGLTF(rocketUrl, '/draco/')

	/*
	  Rotation is skipped outright under `prefers-reduced-motion`, rather than
	  slowed. The CSS block in `globals.css` cannot reach a render loop, so the
	  guard has to live here.
	*/
	const prefersReducedMotion =
		typeof window !== 'undefined' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches

	useFrame((_, delta) => {
		if (prefersReducedMotion || !ref.current) return
		ref.current.rotation.z += delta * 0.4
	})

	return (
		/*
		  In flight across the frame, lower left to upper right: tilted 45
		  degrees in the view, turned side-on (the file points its length, z, at
		  the camera, which shows a rocket as a circle with fins), and rolling
		  about that length the way a rocket spins. Centered, so the roll is about
		  its middle rather than the origin it was modelled at.
		*/
		<group rotation={[0, 0, Math.PI / 4]}>
			<group rotation={[0, Math.PI / 2, 0]}>
				<group ref={ref}>
					<Center>
						<primitive object={scene} />
					</Center>
				</group>
			</group>
		</group>
	)
}

export default function DocsScenePreviewClient() {
	return (
		<VectrealViewer
			className="h-full w-full"
			// A chrome model shows its environment, not a color of its own: the key preset left it a black silhouette.
			envOptions={{ preset: 'studio-natural' }}
			shadowsOptions={{ enabled: false }}
			boundsOptions={{ margin: 1.05 }}
		>
			<Rocket />
		</VectrealViewer>
	)
}
