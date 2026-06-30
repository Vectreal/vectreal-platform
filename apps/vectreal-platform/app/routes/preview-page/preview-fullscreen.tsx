import { Button } from '@shared/components/ui/button'
import { ModelFile, SceneLoadResult } from '@vctrl/hooks/use-load-model'
import {
	InfoPopover,
	InfoPopoverCloseButton,
	InfoPopoverContent,
	InfoPopoverText,
	InfoPopoverTrigger,
	InfoPopoverVectrealFooter,
	type ViewerCommand
} from '@vctrl/viewer'
import { memo, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { Route } from './+types/preview-fullscreen'
import { usePreviewScene } from './use-preview-scene'
import CenteredSpinner from '../../components/centered-spinner'
import { ClientVectrealViewer } from '../../components/viewer/client-vectreal-viewer'
import { useHostedPreviewBridge } from '../../lib/domain/embed/hosted-preview-bridge'

interface PreviewInfoPopoverProps {
	title?: string
	description?: string
}

interface PreviewModelProps extends PreviewInfoPopoverProps {
	file: ModelFile | null
	onCommandExecutorReady: ReturnType<
		typeof useHostedPreviewBridge
	>['onCommandExecutorReady']
	onInteractionEvent: ReturnType<
		typeof useHostedPreviewBridge
	>['onInteractionEvent']
	sceneData?: SceneLoadResult
}

const PreviewInfoPopover = ({
	title,
	description
}: PreviewInfoPopoverProps) => (
	<InfoPopover className="z-100">
		<InfoPopoverTrigger />
		<InfoPopoverContent>
			<InfoPopoverCloseButton />
			<InfoPopoverText>
				{title ? <p className="mb-3 font-medium">{title}</p> : null}
				{description ? (
					<p>{description}</p>
				) : (
					<p className="opacity-50">No description provided for this scene.</p>
				)}
			</InfoPopoverText>
			<InfoPopoverVectrealFooter />
		</InfoPopoverContent>
	</InfoPopover>
)

const PreviewModel = memo(
	({
		file,
		sceneData,
		title,
		description,
		onInteractionEvent,
		onCommandExecutorReady
	}: PreviewModelProps) => {
		return (
			<div className="h-screen w-full">
				<ClientVectrealViewer
					boundsOptions={sceneData?.bounds}
					cameraOptions={sceneData?.camera}
					className="h-full w-full"
					model={file?.model}
					envOptions={sceneData?.environment}
					controlsOptions={sceneData?.controls}
					onCommandExecutorReady={onCommandExecutorReady}
					onInteractionEvent={onInteractionEvent}
					shadowsOptions={sceneData?.shadows}
					staticShadowBake
					normalizationOptions={sceneData?.normalization}
					popover={
						<PreviewInfoPopover title={title} description={description} />
					}
					loader={<CenteredSpinner text="Preparing scene..." />}
					fallback={<CenteredSpinner text="Loading scene..." />}
				/>
			</div>
		)
	}
)

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
	const { file, isLoadingScene, sceneData, previewError, retrySceneLoad } =
		usePreviewScene({
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

	if (previewError && !file?.model) {
		return (
			<div className="bg-background flex h-screen w-full items-center justify-center p-6">
				<div className="border-border bg-card w-full max-w-lg space-y-4 rounded-2xl border p-6">
					<h1 className="text-lg font-semibold">
						Unable to Load Scene Preview
					</h1>
					<p className="text-muted-foreground text-sm">
						{previewError.message}
					</p>
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
		<PreviewModel
			file={file}
			onCommandExecutorReady={onCommandExecutorReady}
			onInteractionEvent={onInteractionEvent}
			sceneData={sceneData}
			title={sceneData?.meta?.name?.trim() || undefined}
			description={sceneData?.meta?.description?.trim() || undefined}
		/>
	)
}

export default PreviewFullscreenPage
