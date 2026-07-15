import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { VectrealViewer } from '@vctrl/viewer'
import { ToneMappingMode } from 'postprocessing'
import { useEffect, useRef } from 'react'

import rocket from '../../assets/models/rocket-v3.glb?url'
import CenteredSpinner from '../centered-spinner'

import type { Group } from 'three'

type PointerRef = React.RefObject<{ x: number; y: number }>

interface ModelProps {
	url: string
	pointer: PointerRef
}

const Model = ({ url, pointer }: ModelProps) => {
	const { scene } = useGLTF(url)
	const tiltRef = useRef<Group>(null)

	useFrame((state, delta) => {
		if (!scene) return

		const t = state.clock.getElapsedTime()
		scene.rotation.z = t * Math.PI * 0.1

		// Cursor-reactive tilt driven by a WINDOW-normalized pointer (updated only
		// on real mouse movement). This is decoupled from the canvas bounding rect,
		// so scrolling the page never shifts the target — no snapping. Delta is
		// clamped and damping is exponential for frame-rate-independent smoothing.
		if (tiltRef.current) {
			const targetY = pointer.current.x * 0.4
			const targetX = pointer.current.y * 0.28
			const idle = Math.sin(t * 0.6) * 0.04
			const clamped = Math.min(delta, 1 / 30)
			const ease = 1 - Math.exp(-5 * clamped)
			tiltRef.current.rotation.y +=
				(targetY + idle - tiltRef.current.rotation.y) * ease
			tiltRef.current.rotation.x +=
				(targetX - tiltRef.current.rotation.x) * ease
		}
	})

	return (
		scene && (
			<group ref={tiltRef}>
				<group rotation={[0, 0, -Math.PI / 4 - Math.PI / 2]}>
					<group rotation={[0, -Math.PI / 2, 0]}>
						<primitive object={scene} />

						<EffectComposer>
							<ToneMapping
								toneMappingMode={ToneMappingMode.ACES_FILMIC}
								adaptionRate={1}
							/>
						</EffectComposer>
					</group>
				</group>
			</group>
		)
	)
}

interface HeroSceneClientProps {
	// Used for separate rendering of rocket on landing/home and sign-up pages. On landing/home,
	// the rocket is rendered in a slanted orientation, while on sign-up, it is rendered in a vertical orientation.
	vertical?: boolean
}

const HeroSceneClient = ({ vertical }: HeroSceneClientProps) => {
	const pointer = useRef({ x: 0, y: 0 })

	useEffect(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
		const onMove = (e: PointerEvent) => {
			// Normalize to viewport, -1..1. Independent of scroll position.
			pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
			pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1
		}
		window.addEventListener('pointermove', onMove, { passive: true })
		return () => window.removeEventListener('pointermove', onMove)
	}, [])

	return (
		<div className="relative h-full w-full overflow-hidden max-md:h-[50vh] max-md:min-h-[300px] max-sm:h-[50vh]">
			<VectrealViewer
				theme="dark"
				loader={<CenteredSpinner text="Loading model..." />}
				controlsOptions={{ enabled: false }}
				envOptions={{ preset: 'studio-key' }}
				shadowsOptions={{ type: 'contact', opacity: 0 }}
				boundsOptions={{ margin: 0.9 }}
			>
				<group rotation={vertical ? [0, 0, Math.PI / 4] : [0, 0, 0]}>
					<Model url={rocket} pointer={pointer} />
				</group>
			</VectrealViewer>
		</div>
	)
}

export default HeroSceneClient
