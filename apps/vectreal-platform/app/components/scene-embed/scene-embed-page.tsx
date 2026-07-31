import { Button } from '@shared/components/ui/button'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'

import SceneEmbedInfoPopover from './scene-embed-info-popover'
import SceneEmbedViewer from './scene-embed-viewer'
import { useSceneEmbedScene } from './use-scene-embed-scene'
import { useHostedPreviewBridge } from '../../lib/domain/embed/hosted-preview-bridge'
import CenteredSpinner from '../centered-spinner'

import type { ViewerCommand } from '@vctrl/viewer'

export interface SceneEmbedPageProps {
	projectId?: string
	sceneId?: string
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
const SceneEmbedPage = ({ projectId, sceneId }: SceneEmbedPageProps) => {
	const { file, isLoadingScene, sceneData, loadError, retrySceneLoad } =
		useSceneEmbedScene({
			sceneId,
			projectId
		})
	const initialCommands = useInitialCommands()
	const { onCommandExecutorReady, onInteractionEvent } = useHostedPreviewBridge(
		{
			sceneId,
			interactions: sceneData?.interactions,
			cameras: sceneData?.camera?.cameras,
			initialCommands
		}
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
		<SceneEmbedViewer
			className="h-screen"
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
	)
}

export default SceneEmbedPage
