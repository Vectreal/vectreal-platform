import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { cn } from '@shared/utils'
import { VectrealViewer } from '@vctrl/viewer'
import { ToneMappingMode } from 'postprocessing'
import { useEffect, useRef } from 'react'

import rocket from '../../assets/models/rocket-v3.glb?url'
import CenteredSpinner from '../centered-spinner'

import type { Group } from 'three'

type PointerRef = React.MutableRefObject<{ x: number; y: number }>

interface ModelProps {
	url: string
	vertical?: boolean
	pointer: PointerRef
}

const Model = ({ url, vertical, pointer }: ModelProps) => {
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
				<group rotation={[0, 0, -Math.PI / (vertical ? 2 : 4)]}>
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

interface HeroSceneProps {
	vertical?: boolean
}

const HeroSceneClient = ({ vertical }: HeroSceneProps) => {
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
		<div
			className={cn(
				'relative w-full overflow-hidden max-sm:h-100',
				vertical && 'h-full max-md:h-[50vh] max-md:min-h-[300px]'
			)}
		>
			<VectrealViewer
				theme="dark"
				loader={<CenteredSpinner text="Loading model..." />}
				controlsOptions={{ enabled: false }}
				envOptions={{ preset: vertical ? 'studio-key' : 'night-city' }}
				shadowsOptions={{ type: 'contact', opacity: 0 }}
				boundsOptions={{ margin: 0.85 }}
			>
				<Model url={rocket} vertical={vertical} pointer={pointer} />
			</VectrealViewer>
		</div>
	)
}

export default HeroSceneClient
