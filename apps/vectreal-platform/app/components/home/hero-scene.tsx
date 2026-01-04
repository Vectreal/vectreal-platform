import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { SpinnerWrapper } from '@shared/components/ui/spinner-wrapper'
import { cn } from '@shared/utils'
import { VectrealViewer } from '@vctrl/viewer'
import { motion } from 'framer-motion'
import { ToneMappingMode } from 'postprocessing'
import React, { useEffect, useState } from 'react'

import rocket from '../../assets/models/rocket-v3.glb?url'

type ReactState<T> = [T, React.Dispatch<React.SetStateAction<T>>]

interface ModelProps {
	url: string
	loadedState: ReactState<boolean>
	vertical?: boolean
}

const Model = ({ url, loadedState, vertical }: ModelProps) => {
	const [isLoaded, setIsLoaded] = loadedState
	const { scene } = useGLTF(url)

	useEffect(() => {
		if (!scene || isLoaded) return

		setIsLoaded(true)
	}, [scene, setIsLoaded, isLoaded])

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
							toneMapptinMode={ToneMappingMode.ACES_FILMIC}
							adaptionRate={1}
						/>
					</EffectComposer>
				</group>
			</group>
		)
	)
}

const fadeVariants = {
	hidden: { opacity: 0 },
	visible: { opacity: 1 }
}

interface HeroSceneProps {
	vertical?: boolean
}

const HeroScene = ({ vertical }: HeroSceneProps) => {
	const [modelUrl, setModelUrl] = useState('')

	const loadedState = useState(false)
	const [isLodaded] = loadedState

	useEffect(() => {
		setModelUrl(rocket)
	}, [])

	return (
		<div
			className={cn(
				'relative w-full overflow-hidden',
				vertical && 'h-full max-md:h-[50vh] max-md:min-h-[300px]'
			)}
		>
			<motion.div
				initial="hidden"
				animate={isLodaded ? 'visible' : 'hidden'}
				exit="hidden"
				variants={fadeVariants}
				transition={{ duration: 0.5, delay: 0.5, ease: 'easeInOut' }}
				className="h-full"
			>
				<VectrealViewer
					infoPopoverOptions={{ showInfo: false }}
					envOptions={{ preset: vertical ? 'studio-key' : 'night-city' }}
					shadowsOptions={{ type: 'contact', opacity: 0 }}
					boundsOptions={{ fit: true, clip: true, margin: 0.85 }}
					className={cn(!isLodaded && 'invisible')}
				>
					<Model url={modelUrl} loadedState={loadedState} vertical={vertical} />
				</VectrealViewer>
			</motion.div>
			<motion.div
				initial="hidden"
				animate={!isLodaded ? 'visible' : 'hidden'}
				exit="hidden"
				variants={fadeVariants}
				className="absolute inset-0 z-10"
			>
				<SpinnerWrapper>
					<div className="text-muted! flex flex-col items-center justify-center gap-4 rounded-xl">
						<p className="text-muted-foreground/50! font-light!">
							Loading model...
						</p>
						<LoadingSpinner />
					</div>
				</SpinnerWrapper>
			</motion.div>
		</div>
	)
}

export default HeroScene
