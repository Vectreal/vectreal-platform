import { useGLTF } from '@react-three/drei'
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { SpinnerWrapper } from '@shared/components/ui/spinner-wrapper'
import {
	InfoPopover,
	InfoPopoverCloseButton,
	InfoPopoverContent,
	InfoPopoverText,
	InfoPopoverTrigger,
	InfoPopoverVectrealFooter,
	VectrealViewer
} from '@vctrl/viewer'
import { ExternalLink, Sparkles } from 'lucide-react'
import { Link } from 'react-router'

import bike from '../../assets/models/bike.glb?url'

const InfoContent = () => (
	<InfoPopover>
		<InfoPopoverTrigger />
		<InfoPopoverContent>
			<InfoPopoverCloseButton />
			<InfoPopoverText className="flex flex-col gap-2 font-[DM_Sans]">
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
			</InfoPopoverText>
			<InfoPopoverVectrealFooter />
		</InfoPopoverContent>
	</InfoPopover>
)

const Model = ({ url }: { url: string }) => {
	const { scene } = useGLTF(url)
	return <primitive object={scene} />
}

const ProductSceneClient = () => {
	return (
		<VectrealViewer
			key="preview-shop-bike-scene"
			cameraOptions={{
				position: [2, 1, 0]
			}}
			boundsOptions={{
				margin: 0.75,
				maxDuration: 1
			}}
			controlsOptions={{
				autoRotate: false,
				rotateSpeed: 0.4,
				dampingFactor: 0.25,
				minDistance: 1,
				maxDistance: 2.5
			}}
			envOptions={{
				preset: 'nature-park',
				background: true,
				backgroundBlurriness: 0.75
			}}
			popover={<InfoContent />}
			loader={
				<SpinnerWrapper>
					<LoadingSpinner className="text-white" />
				</SpinnerWrapper>
			}
		>
			<Model url={bike} />
		</VectrealViewer>
	)
}

export default ProductSceneClient
