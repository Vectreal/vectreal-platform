import { ModelFile, SceneLoadResult } from '@vctrl/hooks/use-load-model'
import {
	InfoPopover,
	InfoPopoverCloseButton,
	InfoPopoverContent,
	InfoPopoverText,
	InfoPopoverTrigger,
	InfoPopoverVectrealFooter
} from '@vctrl/viewer'
import { memo } from 'react'

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
	<InfoPopover>
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

const PreviewFullscreenPage = ({ params }: Route.ComponentProps) => {
	const sceneId = params.sceneId
	const projectId = params.projectId
	const { file, isLoadingScene, sceneData } = usePreviewScene({
		sceneId,
		projectId
	})
	const { onCommandExecutorReady, onInteractionEvent } = useHostedPreviewBridge(
		{
			sceneId,
			interactions: sceneData?.interactions
		}
	)

	if (isLoadingScene && !file?.model) {
		return <CenteredSpinner className="h-screen" text="Loading scene..." />
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
