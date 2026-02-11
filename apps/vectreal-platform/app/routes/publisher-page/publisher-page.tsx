import { useIsMobile } from '@shared/components/hooks/use-mobile'
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { SpinnerWrapper } from '@shared/components/ui/spinner-wrapper'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { VectrealViewer } from '@vctrl/viewer'
import { AnimatePresence } from 'framer-motion'
import { motion } from 'framer-motion'
import { useAtom, useAtomValue } from 'jotai/react'
import { RESET } from 'jotai/utils'
import { memo, Suspense, useCallback, useEffect, useState } from 'react'

import { processAtom } from '../../lib/stores/publisher-config-store'
import {
	boundsAtom,
	cameraAtom,
	controlsAtom,
	environmentAtom,
	shadowsAtom
} from '../../lib/stores/scene-settings-store'
import { isMobileRequest } from '../../lib/utils/is-mobile-request'

import { Route } from './+types/publisher-page'
import { DropZone } from './drop-zone'

export async function loader({ request, params }: Route.LoaderArgs) {
	return {
		isMobile: isMobileRequest(request),
		sceneId: params.sceneId || null
	}
}

const LOADING_MESSAGES = [
	'Preparing the Publisher...',
	'Adjusting the lighting...',
	'Cleaning the lenses...',
	'Loading geometry data...',
	'Calibrating the viewer...'
]

const LoadingScreen = memo(() => {
	const [loadingMessage, setLoadingMessage] = useState('Initializing...')

	useEffect(() => {
		let messageIndex = 0
		let interval: NodeJS.Timeout

		const timeout = setTimeout(() => {
			interval = setInterval(() => {
				messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length
				setLoadingMessage(LOADING_MESSAGES[messageIndex])
			}, 6000)
		}, 3000)

		return () => {
			clearInterval(interval)
			clearTimeout(timeout)
		}
	}, [])

	return (
		<SpinnerWrapper>
			<LoadingSpinner />
			<AnimatePresence mode="wait">
				<motion.div
					key={loadingMessage}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.5 }}
				>
					<p className="text-muted-foreground mt-4 text-center">
						{loadingMessage}
					</p>
				</motion.div>
			</AnimatePresence>
		</SpinnerWrapper>
	)
})

const PublisherPage: React.FC<Route.ComponentProps> = ({ loaderData }) => {
	const isMobile = useIsMobile(loaderData.isMobile)

	// Get model and settings from context/atoms
	const { file, isFileLoading, reset } = useModelContext()
	const [{ isLoading: isDownloading, isInitializing }, setProcess] =
		useAtom(processAtom)
	const bounds = useAtomValue(boundsAtom)
	const camera = useAtomValue(cameraAtom)
	const controls = useAtomValue(controlsAtom)
	const env = useAtomValue(environmentAtom)
	const shadows = useAtomValue(shadowsAtom)

	const handleScreenshot = useCallback((url: string) => {
		// Future: handle screenshot
	}, [])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			reset()
			setProcess(RESET)
		}
	}, [setProcess, reset])

	const isLoading = isInitializing || isDownloading || isFileLoading

	return (
		<div className="-z-0 grow overflow-clip">
			<Suspense fallback={null}>
				<AnimatePresence mode="wait">
					{file?.model || isLoading ? (
						<motion.div
							key="model-viewer"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.75, delay: 1 }}
							className="bg-muted/50 flex h-full w-full"
						>
							<VectrealViewer
								model={file?.model}
								key="model-viewer"
								cameraOptions={camera}
								controlsOptions={controls}
								envOptions={env}
								shadowsOptions={shadows}
								boundsOptions={bounds}
								loader={<LoadingScreen />}
								onScreenshot={handleScreenshot}
							/>
						</motion.div>
					) : (
						<motion.div
							key="drop-zone"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.3 }}
							className="relative flex h-full w-full items-center justify-center"
						>
							<DropZone key="drop-zone" isMobile={isMobile} />
						</motion.div>
					)}
				</AnimatePresence>
			</Suspense>
		</div>
	)
}

export default PublisherPage
