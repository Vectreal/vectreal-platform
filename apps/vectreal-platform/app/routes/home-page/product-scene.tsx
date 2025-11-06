'use client'

import { useGLTF } from '@react-three/drei'
import { VectrealViewer } from '@vctrl/viewer'
import { LoadingSpinner } from '@vctrl-ui/ui/loading-spinner'
import { SpinnerWrapper } from '@vctrl-ui/ui/spinner-wrapper'
import { ExternalLink, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Link } from 'react-router'

import bike from '../../assets/models/bike.glb?url'

const InfoContent = () => (
	<div className="flex flex-col gap-2 font-[DM_Sans]">
		<small className="text-muted-foreground">
			<Sparkles size={12} className="mr-2 inline" /> Optimized with Vectreal
		</small>
		<Link
			className="text-primary mr-8 inline transition-opacity hover:opacity-50"
			to="https://skfb.ly/oQwyy"
			target="_blank"
			referrerPolicy="no-referrer"
		>
			Santa Cruz V10 Downhill Mountain Bicycle{' '}
			<ExternalLink className="mb-1 inline" size={10} />
		</Link>

		<small className="text-muted-foreground">
			by Arsen Ismailov is licensed under{' '}
			<Link
				viewTransition
				className="underline! transition-opacity hover:opacity-50"
				to="http://creativecommons.org/licenses/by/4.0/"
			>
				Creative Commons Attribution
			</Link>
			.
		</small>
	</div>
)

const ProductScene = () => {
	const [modelUrl, setModelUrl] = useState('')
	const { scene } = useGLTF(modelUrl || '', true) // preload = true

	useEffect(() => {
		setModelUrl(bike)
	}, [])

	return (
		<VectrealViewer
			cameraOptions={{
				position: [-1.4, 0, 0]
			}}
			controlsOptions={{
				autoRotate: true,
				autoRotateSpeed: 0.25,
				rotateSpeed: 0.4,
				dampingFactor: 0.25,
				minDistance: 1,
				maxDistance: 2.5
			}}
			envOptions={{
				preset: 'nature-park'
			}}
			model={scene}
			infoPopoverOptions={{
				content: <InfoContent />
			}}
			loader={
				<SpinnerWrapper>
					<LoadingSpinner className="text-white" />
				</SpinnerWrapper>
			}
		/>
	)
}

export default ProductScene
