import { Button } from '@shared/components/ui/button'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import SceneEmbedInfoPopover from './scene-embed-info-popover'
import SceneEmbedViewer from './scene-embed-viewer'
import { useSceneEmbedScene } from './use-scene-embed-scene'
import { useHostedPreviewBridge } from '../../lib/domain/embed/hosted-preview-bridge'
import { isSceneCamera } from '../../lib/domain/scene/scene-camera'
import CenteredSpinner from '../centered-spinner'

import type {
	ViewerCommand,
	ViewerCommandExecutor,
	ViewerInteractionEvent
} from '@vctrl/viewer'
import type { ReactNode } from 'react'

/** What an overlay needs from the running viewer. */
export interface SceneEmbedViewerControl {
	/** Scene cameras only; hotspots and the like are navigational. */
	cameras: { cameraId: string; name?: null | string }[]
	activeCameraId: null | string
	activateCamera: (cameraId: string) => void
}

export interface SceneEmbedPageProps {
	projectId?: string
	sceneId?: string
	/**
	 * Rendered over the viewer. A function because chrome needs the live control
	 * surface, which only exists once the viewer has registered its executor.
	 */
	chrome?: (control: SceneEmbedViewerControl) => ReactNode
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
	chrome
}: SceneEmbedPageProps) => {
	const { file, isLoadingScene, sceneData, loadError, retrySceneLoad } =
		useSceneEmbedScene({
			sceneId,
			projectId
		})
	const initialCommands = useInitialCommands()
	const bridge = useHostedPreviewBridge({
		sceneId,
		interactions: sceneData?.interactions,
		cameras: sceneData?.camera?.cameras,
		initialCommands
	})

	const executorRef = useRef<null | ViewerCommandExecutor>(null)
	const [activeCameraId, setActiveCameraId] = useState<null | string>(null)

	// `useHostedPreviewBridge` returns a fresh object each render, and the viewer
	// re-runs its executor-registration effect whenever these props change
	// identity — unregistering with `null` on the way through. Reading the bridge
	// from a ref keeps the callbacks below referentially stable, so tracking the
	// active camera in state cannot tear down the executor that switching needs.
	const bridgeRef = useRef(bridge)
	bridgeRef.current = bridge

	// The embed SDK bridge and the chrome both need these, so they chain rather
	// than compete for the viewer's single callback slot.
	const onCommandExecutorReady = useCallback(
		(executor: null | ViewerCommandExecutor) => {
			executorRef.current = executor
			bridgeRef.current.onCommandExecutorReady?.(executor)
		},
		[]
	)

	const onInteractionEvent = useCallback((event: ViewerInteractionEvent) => {
		if (event.type === 'camera_changed') {
			setActiveCameraId(event.cameraId)
		} else if (event.type === 'initial_framing_completed' && event.cameraId) {
			setActiveCameraId(event.cameraId)
		}

		bridgeRef.current.onInteractionEvent?.(event)
	}, [])

	const activateCamera = useCallback((cameraId: string) => {
		executorRef.current?.execute({ type: 'activate_camera', cameraId })
	}, [])

	const sceneCameras = useMemo(
		() => (sceneData?.camera?.cameras ?? []).filter(isSceneCamera),
		[sceneData?.camera?.cameras]
	)

	if (isLoadingScene && !file?.model) {
		return <CenteredSpinner className="h-screen" text="Loading scene..." />
	}

	if (loadError && !file?.model) {
		return (
			<div className="bg-background flex h-screen w-full items-center justify-center p-6">
				<div className="border-border bg-card w-full max-w-lg space-y-4 rounded-2xl border p-6">
					<h1 className="text-lg font-semibold">Unable to Load Scene Preview</h1>
					<p className="text-muted-foreground text-sm">{loadError.message}</p>
					<div className="flex gap-2">
						<Button type="button" onClick={() => void retrySceneLoad()}>
							Retry
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => window.history.back()}
						>
							Go Back
						</Button>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="relative h-screen w-full">
			<SceneEmbedViewer
				file={file}
				sceneData={sceneData}
				onCommandExecutorReady={onCommandExecutorReady}
				onInteractionEvent={onInteractionEvent}
				popover={
					<SceneEmbedInfoPopover
						title={sceneData?.meta?.name?.trim() || undefined}
						description={sceneData?.meta?.description?.trim() || undefined}
					/>
				}
			/>
			{chrome?.({
				cameras: sceneCameras,
				activeCameraId,
				activateCamera
			})}
		</div>
	)
}

export default SceneEmbedPage
