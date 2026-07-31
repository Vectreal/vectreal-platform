import { cn } from '@shared/utils'
import { memo, useMemo } from 'react'

import { resolveBakedShadowSource } from '../../lib/domain/scene/client/baked-shadow-source'
import CenteredSpinner from '../centered-spinner'
import { ClientVectrealViewer } from '../viewer/client-vectreal-viewer'

import type { ModelFile, SceneLoadResult } from '@vctrl/hooks/use-load-model'
import type { VectrealViewerProps, ViewerLoadingThumbnail } from '@vctrl/viewer'
import type { ReactNode } from 'react'

export interface SceneEmbedViewerProps {
	file: ModelFile | null
	sceneData?: SceneLoadResult
	/** Sizing for the wrapper. The viewer always fills it. */
	className?: string
	loadingThumbnail?: ViewerLoadingThumbnail
	/** Usually `<SceneEmbedInfoPopover>`; omitted where the surface has its own. */
	popover?: ReactNode
	onCommandExecutorReady?: VectrealViewerProps['onCommandExecutorReady']
	onInteractionEvent?: VectrealViewerProps['onInteractionEvent']
}

/**
 * A published scene rendered exactly as an embed renders it: no chrome, no
 * editing affordances, every setting read from the scene's own saved data.
 *
 * The dashboard scene page, the internal preview route, and the external embed
 * route all show the same thing, so they all render this. Anything a surface
 * puts *on top* is its own business and stays outside this component.
 */
const SceneEmbedViewer = memo(
	({
		file,
		sceneData,
		className,
		loadingThumbnail,
		popover,
		onCommandExecutorReady,
		onInteractionEvent
	}: SceneEmbedViewerProps) => {
		// The persisted bake from the scene's inlined asset data, so a scene renders
		// its stored shadow alongside the model instead of re-baking on load.
		const bakedShadow = useMemo(
			() => resolveBakedShadowSource(sceneData?.shadows, sceneData?.assetData),
			[sceneData?.shadows, sceneData?.assetData]
		)

		return (
			<div className={cn('relative h-full w-full', className)}>
				<ClientVectrealViewer
					model={file?.model}
					boundsOptions={sceneData?.bounds}
					cameraOptions={sceneData?.camera}
					controlsOptions={sceneData?.controls}
					envOptions={sceneData?.environment}
					normalizationOptions={sceneData?.normalization}
					shadowsOptions={sceneData?.shadows}
					staticShadowBake
					bakedShadow={bakedShadow}
					loadingThumbnail={loadingThumbnail}
					popover={popover}
					onCommandExecutorReady={onCommandExecutorReady}
					onInteractionEvent={onInteractionEvent}
					loader={<CenteredSpinner text="Preparing scene..." />}
					fallback={<CenteredSpinner text="Loading scene..." />}
				/>
			</div>
		)
	}
)

SceneEmbedViewer.displayName = 'SceneEmbedViewer'

export default SceneEmbedViewer
