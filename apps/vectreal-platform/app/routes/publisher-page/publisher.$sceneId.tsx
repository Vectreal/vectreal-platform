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
import { useNavigation, useParams } from 'react-router'

import { Route } from './+types/publisher.$sceneId'
import { DropZone } from './drop-zone'
import CenteredSpinner from '../../components/centered-spinner'
import { PublisherEditorScene } from '../../components/publisher/publisher-editor-scene'
import { usePublisherViewerCapture } from '../../components/publisher/publisher-viewer-capture-context'
import { ClientVectrealViewer } from '../../components/viewer/client-vectreal-viewer'
import {
	processInitialState,
	publisherLoadingStateAtom,
	processAtom,
	sceneMetaAtom,
	toolSidebarStateAtom
} from '../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../lib/stores/scene-optimization-store'
import {
	bakedShadowSourceAtom,
	rawModelDiagonalAtom,
	sceneViewerSettingsAtom,
	selectedCameraIdAtom,
	shadowsAtom
} from '../../lib/stores/scene-settings-store'
import { identifyMobileRequest } from '../../lib/utils/identify-mobile-request'
import { toViewerLoadingThumbnail } from '../../lib/viewer/viewer-loading-thumbnail'

import type {
	SceneCameraSnapshotCapture,
	SceneScreenshotCapture,
	ShadowBakeCapture,
	ViewerCommandExecutor
} from '@vctrl/viewer'
import type { ShouldRevalidateFunction } from 'react-router'

export async function loader({ request }: Route.LoaderArgs) {
	return {
		isMobile: identifyMobileRequest(request)
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

// Debounce window (ms) for committing shadow-light drags. Long enough to
// coalesce a continuous pointer drag into a single re-bake, short enough that
// the commit feels immediate once the user lets go.
const SHADOW_LIGHT_COMMIT_DEBOUNCE_MS = 80

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
	const navigation = useNavigation()
	// True when React Router is loading a publisher route - covers navigating
	// between scene IDs within the publisher layout (e.g. after a new scene
	// is saved and the URL moves from /publisher to /publisher/<id>).
	const isNavigationLoading =
		navigation.state === 'loading' &&
		Boolean(navigation.location?.pathname?.startsWith('/publisher'))
	const setProcess = useSetAtom(processAtom)
	const setOptimizationRuntime = useSetAtom(optimizationRuntimeAtom)
	const setRawDiagonal = useSetAtom(rawModelDiagonalAtom)
	const setShadows = useSetAtom(shadowsAtom)
	const { bounds, camera, controls, env, shadows, normalization } =
		useAtomValue(sceneViewerSettingsAtom)

	// Persist drags of the in-scene shadow light handle. Debounced so a drag
	// commits one re-bake when the user settles, not on every pointer move.
	const shadowLightCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(
		null
	)
	const handleShadowLightChange = useCallback(
		(position: [number, number, number]) => {
			if (shadowLightCommitTimer.current) {
				clearTimeout(shadowLightCommitTimer.current)
			}
			shadowLightCommitTimer.current = setTimeout(() => {
				setShadows((prev) =>
					prev.type === 'accumulative'
						? { ...prev, light: { ...prev.light, position } }
						: prev
				)
			}, SHADOW_LIGHT_COMMIT_DEBOUNCE_MS)
		},
		[setShadows]
	)
	// Clear any pending shadow-light commit on unmount so a debounced setShadows
	// can't fire into an unmounted tree (e.g. navigating away mid-drag).
	useEffect(
		() => () => {
			if (shadowLightCommitTimer.current) {
				clearTimeout(shadowLightCommitTimer.current)
			}
		},
		[]
	)
	const selectedCameraId = useAtomValue(selectedCameraIdAtom)
	const sceneMeta = useAtomValue(sceneMetaAtom)
	const { activeComposeTool, showSidebar } = useAtomValue(toolSidebarStateAtom)
	// The in-scene light handle only belongs to the shadow tool, so show it only
	// while that tool's panel is open (and shadows are on).
	const isShadowToolActive =
		showSidebar && activeComposeTool === 'shadow' && (shadows?.enabled ?? false)
	const loadingThumbnail = toViewerLoadingThumbnail(
		sceneMeta.thumbnailUrl,
		'Scene thumbnail preview'
	)
	const previousRouteSceneIdRef = useRef<null | string>(routeSceneId)
	const {
		registerSceneScreenshotCapture,
		registerSceneCameraSnapshotCapture,
		registerShadowBakeCapture,
		registerCommandExecutor
	} = usePublisherViewerCapture()

	// Persisted shadow bake resolved from the loaded aggregate's inlined asset data
	// (a data URL, no separate request). The viewer ignores it once the bake inputs
	// change during editing (signature mismatch) and re-bakes live.
	const bakedShadow = useAtomValue(bakedShadowSourceAtom) ?? undefined

	const handleScreenshotCaptureReady = useCallback(
		(capture: null | SceneScreenshotCapture) => {
			registerSceneScreenshotCapture(capture)
		},
		[registerSceneScreenshotCapture]
	)

	const handleCameraSnapshotCaptureReady = useCallback(
		(capture: null | SceneCameraSnapshotCapture) => {
			registerSceneCameraSnapshotCapture(capture)
		},
		[registerSceneCameraSnapshotCapture]
	)

	const handleCommandExecutorReady = useCallback(
		(executor: null | ViewerCommandExecutor) => {
			registerCommandExecutor(executor)
		},
		[registerCommandExecutor]
	)

	const handleShadowBakeReady = useCallback(
		(capture: null | ShadowBakeCapture) => {
			registerShadowBakeCapture(capture)
		},
		[registerShadowBakeCapture]
	)

	// Cleanup on unmount
	useEffect(() => {
		const previousRouteSceneId = previousRouteSceneIdRef.current
		const navigatedFromSceneToBase =
			Boolean(previousRouteSceneId) && !routeSceneId

		if (navigatedFromSceneToBase) {
			registerSceneScreenshotCapture(null)
			registerSceneCameraSnapshotCapture(null)
			reset()
			setProcess(processInitialState)
			setOptimizationRuntime(RESET)
		}

		previousRouteSceneIdRef.current = routeSceneId
	}, [
		routeSceneId,
		registerSceneCameraSnapshotCapture,
		registerSceneScreenshotCapture,
		reset,
		setOptimizationRuntime,
		setProcess
	])

	useEffect(() => {
		return () => {
			registerSceneScreenshotCapture(null)
			registerSceneCameraSnapshotCapture(null)
			reset()
			setProcess(processInitialState)
			setOptimizationRuntime(RESET)
		}
	}, [
		registerSceneCameraSnapshotCapture,
		registerSceneScreenshotCapture,
		setOptimizationRuntime,
		setProcess,
		reset
	])

	const isLoading = isInitializing || isDownloading || isFileLoading

	return (
		<div className="z-0 grow overflow-clip">
			<Suspense fallback={<CenteredSpinner text="Loading Publisher..." />}>
				<AnimatePresence mode="wait">
					{!file?.model && (isDownloading || isNavigationLoading) ? (
						<motion.div
							key="idb-rehydration-spinner"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.25 }}
							className="relative flex h-full w-full items-center justify-center"
						>
							<CenteredSpinner
								text={
									isNavigationLoading
										? 'Preparing Publisher...'
										: 'Loading Scene...'
								}
							/>
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
								cameraOptions={{
									...camera,
									activeCameraId: selectedCameraId ?? camera.activeCameraId
								}}
								controlsOptions={controls}
								envOptions={env}
								shadowsOptions={shadows}
								bakedShadow={bakedShadow}
								onShadowBakeReady={handleShadowBakeReady}
								shadowLightEditable={isShadowToolActive}
								onShadowLightChange={handleShadowLightChange}
								normalizationOptions={normalization}
								boundsOptions={bounds}
								loadingThumbnail={loadingThumbnail}
								loader={<LoadingScreen />}
								onScreenshotCaptureReady={handleScreenshotCaptureReady}
								onCameraSnapshotCaptureReady={handleCameraSnapshotCaptureReady}
								onCommandExecutorReady={handleCommandExecutorReady}
								onRawDiagonalComputed={setRawDiagonal}
								fallback={<LoadingScreen />}
							>
								{file?.model && <PublisherEditorScene />}
							</ClientVectrealViewer>
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
