import { cn } from '@shared/utils'
import { memo, useMemo } from 'react'

import { normalizeShadowOptions } from '../../constants/viewer-defaults'
import { resolveBakedShadowSource } from '../../lib/domain/scene/client/baked-shadow-source'
import CenteredSpinner from '../centered-spinner'
import { ClientVectrealViewer } from '../viewer/client-vectreal-viewer'

import type { EmbedViewerTheme } from '../../lib/domain/embed/embed-viewer-theme'
import type { ModelFile, ServerSceneData } from '@vctrl/hooks/use-load-model'
import type { VectrealViewerProps, ViewerLoadingThumbnail } from '@vctrl/viewer'
import type { ReactNode } from 'react'

export interface SceneEmbedViewerProps {
	file: ModelFile | null
	sceneData?: ServerSceneData
	/** Sizing for the wrapper. The viewer always fills it. */
	className?: string
	loadingThumbnail?: ViewerLoadingThumbnail
	/** Usually `<SceneEmbedInfoPopover>`; omitted where the surface has its own. */
	popover?: ReactNode
	/**
	 * The Vectreal mark, when the owning plan has not bought its removal.
	 *
	 * Separate from `popover` because the author controls one and the plan
	 * controls the other; they are composed into the viewer's single overlay
	 * slot here so both are gated on the scene being ready.
	 */
	branding?: ReactNode
	/**
	 * Color scheme for the viewer's own chrome.
	 *
	 * Required, and deliberately without a default. This component renders
	 * inside somebody else's page as often as inside ours, and
	 * `ClientVectrealViewer` defaults to `dark` - which is how every embed came
	 * to render dark chrome on light hosts, with nothing in the tree recording
	 * that a choice had been made. A default here would only move that silence
	 * one level up: each surface knows what its own background is, so each
	 * surface says so. That holds for the surfaces rendering this component;
	 * the publisher mounts `ClientVectrealViewer` directly and still takes its
	 * `dark` default, which is its own to fix.
	 *
	 * `EmbedViewerTheme` rather than `VectrealViewerProps['theme']`: the
	 * upstream prop is declared optional, so its type includes `undefined` and
	 * a required prop would still accept one - landing straight back on the
	 * wrapper's `dark`.
	 */
	theme: EmbedViewerTheme
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
		branding,
		theme,
		onCommandExecutorReady,
		onInteractionEvent
	}: SceneEmbedViewerProps) => {
		// Stored rows predate the current shadow shape, so they go through the same
		// normalization the publisher applies. Without it a scene composed in the
		// publisher and the same scene embedded would light differently.
		const shadowsOptions = useMemo(
			() => normalizeShadowOptions(sceneData?.shadows),
			[sceneData?.shadows]
		)

		// The persisted bake from the scene's inlined asset data, so a scene renders
		// its stored shadow alongside the model instead of re-baking on load.
		const bakedShadow = useMemo(
			() => resolveBakedShadowSource(shadowsOptions, sceneData?.assetData),
			[shadowsOptions, sceneData?.assetData]
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
					/*
					  Straight from the scene's own settings, and never with
					  `showInternalHotspots` or `showHiddenHotspots` beside it.

					  That omission is load-bearing rather than tidy. Two of the three
					  surfaces rendering this component are served the *unredacted*
					  manifest - the dashboard's scene detail panel, and `/preview` of a
					  scene that has no published model row yet - so hotspots the author
					  marked `internalOnly` genuinely do arrive in this array, and the
					  viewer's own default is the only thing that stops them being
					  drawn. On the published `/embed` path `redactSettingsForEmbed` has
					  already stripped them server-side; these are two independent
					  gates, and this surface must never open either.
					*/
					hotspots={sceneData?.hotspots}
					shadowsOptions={shadowsOptions}
					staticShadowBake
					bakedShadow={bakedShadow}
					loadingThumbnail={loadingThumbnail}
					popover={
						popover || branding ? (
							<>
								{popover}
								{branding}
							</>
						) : undefined
					}
					theme={theme}
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
