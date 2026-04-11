import { useIsMobile } from '@shared/components/hooks/use-mobile'
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { SpinnerWrapper } from '@shared/components/ui/spinner-wrapper'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { AnimatePresence } from 'framer-motion'
import { motion } from 'framer-motion'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { RESET } from 'jotai/utils'
import {
	memo,
	Suspense,
	useCallback,
	useEffect,
	useRef,
	useState,
	type FC
} from 'react'
import { useParams } from 'react-router'

import { Route } from './+types/publisher.$sceneId'
import { DropZone } from './drop-zone'
import CenteredSpinner from '../../components/centered-spinner'
import { ClientVectrealViewer } from '../../components/viewer/client-vectreal-viewer'
import {
	processInitialState,
	publisherLoadingStateAtom,
	processAtom,
	sceneMetaAtom
} from '../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../lib/stores/scene-optimization-store'
import { sceneViewerSettingsAtom } from '../../lib/stores/scene-settings-store'
import { isMobileRequest } from '../../lib/utils/is-mobile-request'
import { registerSceneScreenshotCaptureHandler } from '../../lib/viewer/scene-screenshot-bus'
import { toViewerLoadingThumbnail } from '../../lib/viewer/viewer-loading-thumbnail'

import type { SceneScreenshotCapture } from '@vctrl/viewer'
import type { ShouldRevalidateFunction } from 'react-router'

export async function loader({ request }: Route.LoaderArgs) {
	return {
		isMobile: isMobileRequest(request)
	}
}

export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	actionResult,
	defaultShouldRevalidate
}) => {
	if (formMethod && formMethod !== 'GET') {
		return true
	}

	if (actionResult) {
		return true
	}

	if (currentUrl.pathname === nextUrl.pathname) {
		return false
	}

	return defaultShouldRevalidate
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
		let interval: ReturnType<typeof setInterval> | undefined

		const timeout = setTimeout(() => {
			interval = setInterval(() => {
				messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length
				setLoadingMessage(LOADING_MESSAGES[messageIndex])
			}, 6000)
		}, 3000)

		return () => {
			if (interval) clearInterval(interval)
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

const PublisherPage: FC<Route.ComponentProps> = ({ loaderData }) => {
	const isMobile = useIsMobile(loaderData.isMobile)
	const params = useParams()
	const routeSceneId = params.sceneId ?? null

	// Get model and settings from context/atoms
	const { file, isFileLoading, reset } = useModelContext()
	const { isDownloading, isInitializing } = useAtomValue(
		publisherLoadingStateAtom
	)
	const setProcess = useSetAtom(processAtom)
	const setOptimizationRuntime = useSetAtom(optimizationRuntimeAtom)
	const { bounds, camera, controls, env, shadows } = useAtomValue(
		sceneViewerSettingsAtom
	)
	const sceneMeta = useAtomValue(sceneMetaAtom)
	const loadingThumbnail = toViewerLoadingThumbnail(
		sceneMeta.thumbnailUrl,
		'Scene thumbnail preview'
	)
	const previousRouteSceneIdRef = useRef<null | string>(routeSceneId)

	const handleScreenshotCaptureReady = useCallback(
		(capture: null | SceneScreenshotCapture) => {
			registerSceneScreenshotCaptureHandler(capture)
		},
		[]
	)

	// Cleanup on unmount
	useEffect(() => {
		const previousRouteSceneId = previousRouteSceneIdRef.current
		const navigatedFromSceneToBase =
			Boolean(previousRouteSceneId) && !routeSceneId

		if (navigatedFromSceneToBase) {
			registerSceneScreenshotCaptureHandler(null)
			reset()
			setProcess(processInitialState)
			setOptimizationRuntime(RESET)
		}

		previousRouteSceneIdRef.current = routeSceneId
	}, [routeSceneId, reset, setOptimizationRuntime, setProcess])

	useEffect(() => {
		return () => {
			registerSceneScreenshotCaptureHandler(null)
			reset()
			setProcess(processInitialState)
			setOptimizationRuntime(RESET)
		}
	}, [setOptimizationRuntime, setProcess, reset])

	const isLoading = isInitializing || isDownloading || isFileLoading

	return (
		<div className="-z-0 grow overflow-clip">
			<Suspense fallback={null}>
				<AnimatePresence mode="wait">
					{!file?.model && isDownloading ? (
						<motion.div
							key="idb-rehydration-spinner"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.25 }}
							className="relative flex h-full w-full items-center justify-center"
						>
							<CenteredSpinner text="Loading Scene..." />
						</motion.div>
					) : file?.model || isLoading ? (
						<motion.div
							key="model-viewer"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0, transition: { duration: 0.4 } }}
							transition={{ duration: 0.75, delay: 1 }}
							className="bg-muted/50 flex h-full w-full"
						>
							<ClientVectrealViewer
								model={file?.model}
								key="model-viewer"
								cameraOptions={camera}
								controlsOptions={controls}
								envOptions={env}
								shadowsOptions={shadows}
								boundsOptions={bounds}
								loadingThumbnail={loadingThumbnail}
								loader={<LoadingScreen />}
								onScreenshotCaptureReady={handleScreenshotCaptureReady}
								fallback={<LoadingScreen />}
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
