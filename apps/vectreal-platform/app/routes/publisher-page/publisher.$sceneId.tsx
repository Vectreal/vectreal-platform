import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { SpinnerWrapper } from '@shared/components/ui/spinner-wrapper'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import CenteredSpinner from '../../components/centered-spinner'
import { PublisherEditorScene } from '../../components/publisher/publisher-editor-scene'
import { usePublisherViewerCapture } from '../../components/publisher/publisher-viewer-capture-context'
import { useAutomaticOpeningView } from '../../components/publisher/shell/use-opening-view'
import { ClientVectrealViewer } from '../../components/viewer/client-vectreal-viewer'
import {
	sceneMetaAtom,
	toolSidebarStateAtom
} from '../../lib/stores/publisher-config-store'
import {
	bakedShadowSourceAtom,
	rawModelDiagonalAtom,
	sceneViewerSettingsAtom,
	selectedCameraIdAtom,
	shadowsAtom
} from '../../lib/stores/scene-settings-store'
import { toViewerLoadingThumbnail } from '../../lib/viewer/viewer-loading-thumbnail'

import type { ShouldRevalidateFunction } from 'react-router'

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

/**
 * The publisher's canvas.
 *
 * It renders the loaded model and nothing else: the shell decides whether this
 * surface is the one on screen, so there is no "what if there is no model yet"
 * branch here to disagree with it.
 */
const PublisherPage = () => {
	const { file } = useModelContext()
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
				setShadows((prev) => ({
					...prev,
					light: { ...prev.light, position }
				}))
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
	const {
		registerSceneScreenshotCapture,
		registerSceneCameraSnapshotCapture,
		registerShadowBakeCapture,
		registerCommandExecutor
	} = usePublisherViewerCapture()

	// Persisted shadow bake resolved from the loaded scene's inlined asset data
	// (a data URL, no separate request). The viewer ignores it once the bake inputs
	// change during editing (signature mismatch) and re-bakes live.
	const bakedShadow = useAtomValue(bakedShadowSourceAtom) ?? undefined
	const handleInteractionEvent = useAutomaticOpeningView()

	// Memoized: a fresh object here re-creates the viewer's screenshot capture on
	// every render, which would de-register it for the frame a save runs in.
	const cameraOptions = useMemo(
		() => ({
			...camera,
			activeCameraId: selectedCameraId ?? camera.activeCameraId
		}),
		[camera, selectedCameraId]
	)

	return (
		<div className="z-0 grow overflow-clip">
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.4 }}
				className="bg-muted/50 relative flex h-full w-full"
			>
				<ClientVectrealViewer
					model={file?.model}
					cameraOptions={cameraOptions}
					controlsOptions={controls}
					envOptions={env}
					shadowsOptions={shadows}
					bakedShadow={bakedShadow}
					onShadowBakeReady={registerShadowBakeCapture}
					shadowLightEditable={isShadowToolActive}
					onShadowLightChange={handleShadowLightChange}
					normalizationOptions={normalization}
					boundsOptions={bounds}
					loadingThumbnail={loadingThumbnail}
					loader={<LoadingScreen />}
					onScreenshotCaptureReady={registerSceneScreenshotCapture}
					onCameraSnapshotCaptureReady={registerSceneCameraSnapshotCapture}
					onCommandExecutorReady={registerCommandExecutor}
					onRawDiagonalComputed={setRawDiagonal}
					onInteractionEvent={handleInteractionEvent}
					fallback={<CenteredSpinner text="Loading Publisher..." />}
				>
					{file?.model && <PublisherEditorScene />}
				</ClientVectrealViewer>
			</motion.div>
		</div>
	)
}

export default PublisherPage
