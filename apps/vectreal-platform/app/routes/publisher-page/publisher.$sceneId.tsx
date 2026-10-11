import { cn } from '@shared/utils'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import AnimationPlaybackBar from '../../components/publisher/animation-playback-bar'
import { PublisherEditorScene } from '../../components/publisher/publisher-editor-scene'
import { usePublisherViewerCapture } from '../../components/publisher/publisher-viewer-capture-context'
import { PublisherLoading } from '../../components/publisher/shell/publisher-loading'
import { PUBLISHER_LAYER } from '../../components/publisher/shell/shell-layout'
import { useAutomaticOpeningView } from '../../components/publisher/shell/use-opening-view'
import { useAnimationReconciliation } from '../../components/publisher/sidebars/compose-sidebar/animation-settings'
import { ClientVectrealViewer } from '../../components/viewer/client-vectreal-viewer'
import {
	isPreviewModeAtom,
	openHotspotInHotspotToolAtom,
	sceneMetaAtom,
	openComposeToolAtom
} from '../../lib/stores/publisher-config-store'
import { comparedModelAtom } from '../../lib/stores/scene-optimization-store'
import {
	activeHotspotIdAtom,
	bakedShadowSourceAtom,
	rawModelDiagonalAtom,
	sceneViewerSettingsAtom,
	selectedCameraIdAtom,
	shadowsAtom
} from '../../lib/stores/scene-settings-store'
import { toViewerLoadingThumbnail } from '../../lib/viewer/viewer-loading-thumbnail'

import type { ViewerInteractionEvent } from '@vctrl/viewer'
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

/**
 * The publisher's canvas.
 *
 * It renders the loaded model and nothing else: the shell decides whether this
 * surface is the one on screen, so there is no "what if there is no model yet"
 * branch here to disagree with it.
 */
const PublisherPage = () => {
	const loadedModel = useModelContext()
	const { file } = loadedModel
	// Here rather than in the Animation tool, so a saved config is matched to
	// the model's clips whether or not that tool is ever opened.
	useAnimationReconciliation()
	// An optimization pass swaps the rendered object but keeps the load, so the
	// viewer keeps the camera and framing where the user left them.
	const modelKey =
		loadedModel.status === 'ready' ? loadedModel.loadId : undefined
	// A held comparison only changes what is drawn: the camera, framing,
	// shadows, animation and hotspots keep following the loaded model.
	const comparedModel = useAtomValue(comparedModelAtom)
	const setRawDiagonal = useSetAtom(rawModelDiagonalAtom)
	const setShadows = useSetAtom(shadowsAtom)
	const {
		animation,
		bounds,
		camera,
		controls,
		environment,
		shadows,
		normalization,
		hotspots
	} = useAtomValue(sceneViewerSettingsAtom)

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

	const [selectedCameraId, setSelectedCameraId] = useAtom(selectedCameraIdAtom)
	const [activeHotspotId, setActiveHotspotId] = useAtom(activeHotspotIdAtom)
	const sceneMeta = useAtomValue(sceneMetaAtom)
	// The tool whose panel is open, not the one merely selected. Every in-scene
	// affordance below scopes to it, so no tool's handles outlive its drawer.
	const openComposeTool = useAtomValue(openComposeToolAtom)
	const isPreviewMode = useAtomValue(isPreviewModeAtom)
	const openHotspotInHotspotTool = useSetAtom(openHotspotInHotspotToolAtom)
	// The in-scene light handle only belongs to the shadow tool, so show it only
	// while that tool's panel is open (and shadows are on).
	const isShadowToolActive =
		openComposeTool === 'shadow' && (shadows?.enabled ?? false)
	const loadingThumbnail = toViewerLoadingThumbnail(
		sceneMeta.thumbnailUrl,
		'Scene thumbnail preview'
	)
	const {
		commandExecutor,
		registerSceneScreenshotCapture,
		registerSceneCameraSnapshotCapture,
		registerShadowBakeCapture,
		registerCommandExecutor,
		registerHotspotPositionSetter
	} = usePublisherViewerCapture()

	// Persisted shadow bake resolved from the loaded scene's inlined asset data
	// (a data URL, no separate request). The viewer ignores it once the bake inputs
	// change during editing (signature mismatch) and re-bakes live.
	const bakedShadow = useAtomValue(bakedShadowSourceAtom) ?? undefined
	const captureOpeningView = useAutomaticOpeningView()

	/**
	 * Mirrors the viewer's own camera changes back into the atom the sidebar
	 * reads.
	 *
	 * Clicking a hotspot activates its linked camera inside the viewer, through
	 * the same command path an embed uses, and that path writes the viewer's
	 * internal selection directly. Without this the atom never learns: the camera
	 * sidebar would highlight the wrong entry, and the next unrelated edit to the
	 * camera list would see the two disagree and fly the camera back to the stale
	 * value.
	 *
	 * It cannot loop. The write re-runs the viewer's selection effect, which
	 * recomputes the identical key and signature the command path already stored
	 * and returns before animating or re-emitting. `selectedCameraIdAtom` is not
	 * part of `sceneViewerSettingsAtom`, so it also cannot mark the scene dirty.
	 */
	// Whether the viewer is playing, as it reports it. Drives the stage's own
	// playback bar, which sends commands but cannot know the outcome itself:
	// a sequence can run out, and the runtime resets when animation is off.
	const [isAnimationPlaying, setIsAnimationPlaying] = useState(false)

	const handleInteractionEvent = useCallback(
		(event: ViewerInteractionEvent) => {
			if (event.type === 'camera_changed' && event.cameraId) {
				setSelectedCameraId(event.cameraId)
			}
			if (event.type === 'animation_state_changed') {
				setIsAnimationPlaying(event.playing)
			}
			captureOpeningView(event)
		},
		[captureOpeningView, setSelectedCameraId]
	)

	/**
	 * In the editor a marker is always picked up for editing, never flown to as
	 * a visitor would: inside the Hotspot tool a click toggles the selection,
	 * and outside it a click opens the tool on that hotspot. Neither moves the
	 * view: placing a marker writes its camera, and standing on that camera
	 * would jerk the view with every placement.
	 *
	 * Preview passes nothing, which is exactly what gives a marker the
	 * visitor's behavior there - a click flies its camera, and the viewer's own
	 * way back leads out.
	 */
	const handleHotspotSelect = useMemo(() => {
		if (isPreviewMode) return undefined
		if (openComposeTool === 'hotspots') {
			return (id: string) =>
				setActiveHotspotId((previous) => (previous === id ? null : id))
		}
		return openHotspotInHotspotTool
	}, [
		isPreviewMode,
		openComposeTool,
		openHotspotInHotspotTool,
		setActiveHotspotId
	])

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
			{/*
			  No entrance of its own: the shell fades the stage in once as it leaves
			  the empty state. A fade here ran again when the loading surface handed
			  over to this one, dipping the spinner out and back mid-load.
			*/}
			<div className="bg-muted/50 relative flex h-full w-full">
				<ClientVectrealViewer
					model={file?.model}
					modelKey={modelKey}
					displayedModel={comparedModel?.model}
					animations={file?.animations}
					animationOptions={animation}
					/*
					  The built-in controls are the published scene's, set by the
					  author's "Visitor controls" choice, so they show in preview. The
					  editor draws its own bar below, clear of the publish card.
					*/
					showAnimationControls={isPreviewMode}
					cameraOptions={cameraOptions}
					controlsOptions={controls}
					envOptions={environment}
					shadowsOptions={shadows}
					bakedShadow={bakedShadow}
					onShadowBakeReady={registerShadowBakeCapture}
					shadowLightEditable={isShadowToolActive}
					hotspots={hotspots}
					/*
					  The publisher is the surface those two flags exist for: it is where
					  `internalOnly` hotspots are authored, and where a hidden one has to
					  stay findable so it can be switched back on. Neither changes a step
					  number - the viewer ranks those over the published set - so the
					  numbers here are the numbers a visitor gets.
					*/
					showInternalHotspots
					showHiddenHotspots
					/*
					  Gated on the tool, like `onHotspotSelect` below it. Left ungated
					  the ring stayed on after switching to the shadow or camera tool,
					  where there is no gizmo and no way to clear it from the canvas.
					*/
					selectedHotspotId={
						openComposeTool === 'hotspots' ? activeHotspotId : null
					}
					onHotspotSelect={handleHotspotSelect}
					/*
					  A visitor's way back from a hotspot's camera, so only where the
					  author is looking as a visitor. In the editor the way back is
					  leaving a hotspot camera's view in the Camera tool.
					*/
					showSceneViewReturn={isPreviewMode}
					onHotspotPositionSetterReady={registerHotspotPositionSetter}
					onShadowLightChange={handleShadowLightChange}
					normalizationOptions={normalization}
					boundsOptions={bounds}
					loadingThumbnail={loadingThumbnail}
					loader={<PublisherLoading />}
					onScreenshotCaptureReady={registerSceneScreenshotCapture}
					onCameraSnapshotCaptureReady={registerSceneCameraSnapshotCapture}
					onCommandExecutorReady={registerCommandExecutor}
					onRawDiagonalComputed={setRawDiagonal}
					onInteractionEvent={handleInteractionEvent}
					fallback={<PublisherLoading />}
				>
					{file?.model && <PublisherEditorScene />}
				</ClientVectrealViewer>
				<AnimationPlaybackBar
					visible={
						!isPreviewMode &&
						!comparedModel &&
						Boolean(animation?.enabled) &&
						(file?.animations?.length ?? 0) > 0
					}
					playing={isAnimationPlaying}
					onToggle={() =>
						commandExecutor.current?.execute({
							type: 'set_animation_playing',
							playing: !isAnimationPlaying
						})
					}
					onRestart={() =>
						commandExecutor.current?.execute({ type: 'restart_animation' })
					}
				/>
				{comparedModel && (
					<div
						className={cn(
							'pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3',
							PUBLISHER_LAYER.compareLabel
						)}
					>
						<p
							role="status"
							className="ds-overlay rounded-full px-3 py-1 text-xs font-medium"
						>
							{comparedModel.isOriginal
								? 'Showing the original'
								: 'Showing the saved version'}
						</p>
					</div>
				)}
			</div>
		</div>
	)
}

export default PublisherPage
