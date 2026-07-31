import { Button } from '@shared/components/ui/button'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { Route } from './+types/preview-fullscreen'
import CenteredSpinner from '../../components/centered-spinner'
import SceneEmbedInfoPopover from '../../components/scene-embed/scene-embed-info-popover'
import SceneEmbedViewer from '../../components/scene-embed/scene-embed-viewer'
import { useSceneEmbedScene } from '../../components/scene-embed/use-scene-embed-scene'
import { useHostedPreviewBridge } from '../../lib/domain/embed/hosted-preview-bridge'

import type { ViewerCommand } from '@vctrl/viewer'

function usePreviewInitialCommands(): ViewerCommand[] {
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

const PreviewFullscreenPage = ({ params }: Route.ComponentProps) => {
	const sceneId = params.sceneId
	const projectId = params.projectId
	const { file, isLoadingScene, sceneData, loadError, retrySceneLoad } =
		useSceneEmbedScene({
			sceneId,
			projectId
		})
	const initialCommands = usePreviewInitialCommands()
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

export default PreviewFullscreenPage
