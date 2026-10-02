/**
 * Client-only R3F scene for the Welcome step.
 * Imported lazily by onboarding-visuals.tsx - never runs on the server.
 */
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { VectrealViewer } from '@vctrl/viewer'

import rocketUrl from '../../assets/models/rocket-v3.glb?url'

const RocketModel = () => {
	const { scene } = useGLTF(rocketUrl)

	useFrame(({ clock }) => {
		if (!scene) return
		scene.rotation.z = clock.getElapsedTime() * Math.PI * 0.1
	})

	return (
		scene && (
			<group rotation={[0, 0, -Math.PI / 3]}>
				<group rotation={[0, -Math.PI / 2, 0]}>
					<primitive object={scene} />
				</group>
			</group>
		)
	)
}

export default function OnboardingWelcomeScene() {
	return (
		<div className="absolute inset-0">
			<VectrealViewer
				theme="dark"
				controlsOptions={{ enabled: false }}
				envOptions={{ preset: 'night-city' }}
				shadowsOptions={{ enabled: false }}
				boundsOptions={{ margin: 0.9 }}
			>
				<RocketModel />
			</VectrealViewer>
		</div>
	)
}
