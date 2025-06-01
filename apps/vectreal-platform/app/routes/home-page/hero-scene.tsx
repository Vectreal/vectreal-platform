'use client'
import { Environment, Stage, useGLTF } from '@react-three/drei'

import { Canvas as BaseCanvas, useFrame } from '@react-three/fiber'
import { EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { useIsMobile } from '@vctrl-ui/hooks/use-mobile'
import { LoadingSpinner } from '@vctrl-ui/ui/loading-spinner'
import { SpinnerWrapper } from '@vctrl-ui/ui/spinner-wrapper'
import { cn } from '@vctrl-ui/utils'
import { motion } from 'framer-motion'
import { ToneMappingMode } from 'postprocessing'
import React, { Suspense, useEffect, useRef, useState } from 'react'

import { Group } from 'three'

import rocket from '../../assets/models/rocket-v2.glb?url'

type ReactState<T> = [T, React.Dispatch<React.SetStateAction<T>>]

interface ModelProps {
	url: string
	loadedState: ReactState<boolean>
	vertical?: boolean
}

const Model = ({ url, loadedState, vertical }: ModelProps) => {
	const [isLoaded, setIsLoaded] = loadedState

	const isMobile = useIsMobile()
	const stageRef = useRef<Group>(null)

	const { scene } = useGLTF(url)

	useEffect(() => {
		if (!scene || isLoaded) return

		setIsLoaded(true)
	}, [scene, setIsLoaded, isLoaded])

	useFrame((state) => {
		if (!scene) return

		const t = state.clock.getElapsedTime()
		scene.rotation.x = 0
		scene.rotation.y = t * Math.PI * 0.1
		scene.rotation.z = 0

		stageRef.current?.position.set(0, Math.cos(t * 1.5) * 0.2, 0)
	})

	return (
		scene && (
			<group
				ref={stageRef}
				position={[0, 0.5, 0]}
				rotation={[0, 0, isMobile || vertical ? 0 : 1.5]}
			>
				<Stage
					environment={null}
					shadows={isMobile ? true : false}
					intensity={0}
					adjustCamera={isMobile ? 0.75 : 0.8}
				>
					<group scale={0.02}>
						<primitive object={scene} />
					</group>
				</Stage>
				<Environment
					files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/abandoned_garage_1k.hdr"
					background={false}
				/>
				<EffectComposer>
					<ToneMapping
						toneMapptinMode={ToneMappingMode.ACES_FILMIC}
						adaptionRate={1}
					/>
				</EffectComposer>
			</group>
		)
	)
}

const fadeVariants = {
	hidden: { opacity: 0 },
	visible: { opacity: 1 }
}

interface HeroSceneProps {
	className?: string
	vertical?: boolean
	limitHeight?: boolean
}

const HeroScene = ({
	className,
	limitHeight = true,
	...props
}: HeroSceneProps) => {
	const [modelUrl, setModelUrl] = useState('')

	const loadedState = useState(false)
	const [isLodaded] = loadedState

	useEffect(() => {
		setModelUrl(rocket)
	}, [])

	return (
		<>
			<motion.div
				className={className}
				variants={fadeVariants}
				initial="hidden"
				animate={isLodaded ? 'visible' : 'hidden'}
				transition={{ duration: 0.5, delay: 0.5, ease: 'easeInOut' }}
				exit="hidden"
			>
				<BaseCanvas
					className={cn(
						'absolute! left-0! h-full',
						limitHeight && 'max-h-4/5 sm:max-h-7/10'
					)}
				>
					<pointLight position={[10, 10, 10]} intensity={2} />
					<ambientLight />
					<Environment preset="sunset" />
					<Suspense fallback={null}>
						<Model url={modelUrl} loadedState={loadedState} {...props} />
					</Suspense>
				</BaseCanvas>
			</motion.div>
			<motion.div
				variants={fadeVariants}
				initial="hidden"
				animate={!isLodaded ? 'visible' : 'hidden'}
				exit="hidden"
				className={cn(
					'absolute top-0 left-0 z-10 w-full',
					limitHeight ? 'h-4/5' : 'h-full'
				)}
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
		</>
	)
}

export default HeroScene
