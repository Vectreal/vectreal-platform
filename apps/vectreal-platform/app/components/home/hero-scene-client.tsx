import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { cn } from '@shared/utils'
import { VectrealViewer } from '@vctrl/viewer'
import { ToneMappingMode } from 'postprocessing'

import rocket from '../../assets/models/rocket-v3.glb?url'
import CenteredSpinner from '../centered-spinner'

interface ModelProps {
	url: string
	vertical?: boolean
}

const Model = ({ url, vertical }: ModelProps) => {
	const { scene } = useGLTF(url)

	useFrame((state) => {
		if (!scene) return

		const t = state.clock.getElapsedTime()

		scene.rotation.z = t * Math.PI * 0.1
	})

	return (
		scene && (
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
		)
	)
}

interface HeroSceneProps {
	vertical?: boolean
}

const HeroSceneClient = ({ vertical }: HeroSceneProps) => {
	return (
		<div
			className={cn(
				'relative w-full overflow-hidden',
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
				<Model url={rocket} vertical={vertical} />
			</VectrealViewer>
		</div>
	)
}

export default HeroSceneClient
