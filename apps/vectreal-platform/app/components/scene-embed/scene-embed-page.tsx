import { SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import { EmbedErrorState } from './embed-error-state'
import SceneEmbedInfoPopover from './scene-embed-info-popover'
import SceneEmbedViewer from './scene-embed-viewer'
import { useSceneEmbedScene } from './use-scene-embed-scene'
import VectrealEmbedBadge from './vectreal-embed-badge'
import {
	resolveEmbedCameraControls,
	resolveEmbedHotspotPresentation
} from '../../lib/domain/embed/embed-presentation'
import { parseEmbedViewerTheme } from '../../lib/domain/embed/embed-viewer-theme'
import { useHostedPreviewBridge } from '../../lib/domain/embed/hosted-preview-bridge'
import { shouldShowInfoPopover } from '../../lib/domain/scene/scene-presentation'
import { useErrorReport } from '../../lib/observability/use-error-report'
import { toViewerLoadingThumbnail } from '../../lib/viewer/viewer-loading-thumbnail'

import type { SceneEmbedManifestResponse } from '../../types/api'
import type {
	VectrealViewerProps,
	ViewerCommand,
	ViewerCommandExecutor,
	ViewerInteractionEvent
} from '@vctrl/viewer'
import type { ReactNode } from 'react'

export interface SceneEmbedPageProps {
	projectId?: string
	sceneId?: string
	/**
	 * Rendered over the viewer. What belongs to the scene - its camera
	 * switcher, playback, the way back from a hotspot - the viewer draws
	 * itself, so both routes show it; this is for what only one surface adds.
	 */
	chrome?: ReactNode
	/**
	 * Color scheme, for a surface that knows its own background.
	 *
	 * `/preview` passes the app's, because it draws `PreviewChrome` over the
	 * viewer in app tokens and the two have to agree. `/embed` passes nothing
	 * and gets the rule below, which is about a page we cannot see.
	 */
	theme?: VectrealViewerProps['theme']
	/**
	 * Draws the Vectreal mark over the scene. Decided server-side from the
	 * owning organization's plan, so only `/embed` passes it; `/preview` is
	 * internal and carries no mark.
	 */
	showsVectrealBranding?: boolean
	/**
	 * The scene manifest, when the document carried it. Loading from it skips
	 * the manifest request; without it the page fetches one.
	 */
	initialManifest?: SceneEmbedManifestResponse | null
}

/** Opening viewer state driven by the embed URL's query parameters. */
function useInitialCommands(): ViewerCommand[] {
	const [searchParams] = useSearchParams()
	return useMemo(() => {
		const commands: ViewerCommand[] = []

		const camera = searchParams.get('camera')?.trim()
		if (camera) {
			commands.push({ type: 'activate_camera', cameraId: camera })
		}

		const autoRotate = searchParams.get('autoRotate')
		if (autoRotate !== null) {
			commands.push({ type: 'set_auto_rotate', enabled: autoRotate !== '0' })
		}

		const transition = searchParams.get('transition')
		if (
			transition === 'none' ||
			transition === 'linear' ||
			transition === 'object_avoidance'
		) {
			commands.push({ type: 'set_transition', transitionType: transition })
		}

		return commands
	}, [searchParams])
}

/** The color scheme the embed URL asks for, defaulting to the visitor's own. */
function useEmbedViewerTheme() {
	const [searchParams] = useSearchParams()
	return parseEmbedViewerTheme(searchParams.get('theme'))
}

/**
 * How the embed's hotspots appear, from the same query string.
 *
 * A channel of its own rather than one more entry in `useInitialCommands`,
 * because none of these is a `ViewerCommand`. Those are executed once when the
 * viewer reports ready; suppressing the markers is not something the viewer
 * does at a moment, it is something it is - as a command it would draw the
 * markers first and take them away on the ready event.
 */
function useHotspotPresentation() {
	const [searchParams] = useSearchParams()
	return useMemo(
		() => resolveEmbedHotspotPresentation(searchParams),
		[searchParams]
	)
}

/** Whether the embedding page left the camera switcher to the viewer. */
function useEmbedCameraControls() {
	const [searchParams] = useSearchParams()
	return resolveEmbedCameraControls(searchParams)
}

/**
 * The full-viewport scene page shared by `/embed` and `/preview`.
 *
 * Both routes render exactly the same thing; they differ only in how their
 * layout authenticates the request. Anything a surface adds on top (the
 * internal preview's chrome) wraps this rather than being switched on inside.
 */
const SceneEmbedPage = ({
	projectId,
	sceneId,
	chrome,
	theme,
	showsVectrealBranding = false,
	initialManifest
}: SceneEmbedPageProps) => {
	const { file, sceneData, loadError, retrySceneLoad } = useSceneEmbedScene({
		sceneId,
		projectId,
		initialManifest
	})
	const initialCommands = useInitialCommands()
	const hotspotPresentation = useHotspotPresentation()
	const showCameraControls = useEmbedCameraControls()
	const embedTheme = useEmbedViewerTheme()
	const bridge = useHostedPreviewBridge({
		sceneId,
		interactions: sceneData?.interactions,
		cameras: sceneData?.camera?.cameras,
		hotspots: sceneData?.hotspots,
		initialCommands
	})

	// `useHostedPreviewBridge` returns a fresh object each render, and the viewer
	// re-runs its executor-registration effect whenever these props change
	// identity — unregistering with `null` on the way through. Reading the bridge
	// from a ref keeps the callbacks below referentially stable.
	const bridgeRef = useRef(bridge)
	bridgeRef.current = bridge

	const [viewerExecutor, setViewerExecutor] =
		useState<null | ViewerCommandExecutor>(null)

	/*
	  The bridge reads a registered executor as "the scene is ready": it answers
	  the host page's ping with the scene's cameras and hotspots, and runs the
	  author's `viewer_ready` interactions. The viewer now mounts while the
	  scene is still loading, and registers before any of those exist, so the
	  bridge is told only once the scene data has arrived. Keyed on whether it
	  has, not on its identity, so the bridge hears of each executor once.
	*/
	const hasSceneData = Boolean(sceneData)
	useEffect(() => {
		if (!hasSceneData || !viewerExecutor) return
		bridgeRef.current.onCommandExecutorReady?.(viewerExecutor)
		return () => bridgeRef.current.onCommandExecutorReady?.(null)
	}, [hasSceneData, viewerExecutor])

	/*
	  A missing environment map leaves the scene lit by a neutral room and the
	  page working, so nothing else reports it: the room is what visitors of
	  this embed see until somebody notices.
	*/
	const [environmentFailure, setEnvironmentFailure] = useState<Error>()
	useErrorReport(environmentFailure, 'client-fallback')

	const onInteractionEvent = useCallback((event: ViewerInteractionEvent) => {
		if (event.type === 'environment_load_failed') {
			setEnvironmentFailure(
				new Error(`Environment map failed to load: ${event.files.join(', ')}`)
			)
		}
		bridgeRef.current.onInteractionEvent?.(event)
	}, [])

	// From the manifest the document carried until the scene data exists, so
	// the thumbnail is up from the first paint rather than after the model.
	const loadingThumbnail = useMemo(() => {
		const refs = sceneData?.assetRefs ?? initialManifest?.assetRefs ?? {}
		const thumbnail = Object.values(refs).find(
			(ref) => ref.fileName === SCENE_THUMBNAIL_FILENAME
		)
		return toViewerLoadingThumbnail(thumbnail?.url)
	}, [sceneData?.assetRefs, initialManifest?.assetRefs])

	if (loadError && !file?.model) {
		return (
			<EmbedErrorState
				kind="load_failed"
				onRetry={() => void retrySceneLoad()}
			/>
		)
	}

	return (
		/*
		  `dvh`, never `vh`. `100vh` is the *large* viewport - the height the page
		  would have with the browser toolbars retracted - so on any browser with
		  persistent bottom chrome (Arc mobile, Safari iOS, Chrome Android) this box
		  overhangs the visible area by exactly the bar height. Everything anchored
		  to its bottom edge, which is the whole preview chrome, lands behind the
		  bar, and the overhang makes `<body>` scrollable.

		  That body scroll is unrecoverable: the canvas fills this box and
		  OrbitControls sets `touch-action: none` on it, so every touch is consumed
		  as an orbit gesture and never reaches the page. The user is left stuck
		  mid-scroll with the controls clipped off.

		  `overflow-hidden` is the backstop - this surface never scrolls, so no
		  child can reintroduce the trap.
		*/
		<div className="relative h-dvh w-full overflow-hidden">
			<SceneEmbedViewer
				file={file}
				sceneData={sceneData}
				loadingThumbnail={loadingThumbnail}
				// A scene that names no environment is lit by the default, which
				// `{}` asks for; an absent manifest says nothing yet.
				environment={
					initialManifest
						? (initialManifest.settings?.environment ?? {})
						: undefined
				}
				onCommandExecutorReady={setViewerExecutor}
				onInteractionEvent={onInteractionEvent}
				hotspotPresentation={hotspotPresentation}
				showCameraControls={showCameraControls}
				theme={theme ?? embedTheme}
				branding={showsVectrealBranding ? <VectrealEmbedBadge /> : undefined}
				/*
				  Omitted, not hidden, when the author switched it off: the slot
				  takes a node, so passing nothing is how a surface says it has no
				  popover. Absent settings still get one - see
				  `shouldShowInfoPopover`.
				*/
				popover={
					shouldShowInfoPopover(sceneData?.presentation) ? (
						<SceneEmbedInfoPopover
							title={sceneData?.meta?.name?.trim() || undefined}
							description={sceneData?.meta?.description?.trim() || undefined}
						/>
					) : undefined
				}
			/>
			{chrome}
		</div>
	)
}

export default SceneEmbedPage
