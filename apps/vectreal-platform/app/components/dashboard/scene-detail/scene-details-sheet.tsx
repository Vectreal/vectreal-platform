import { formatFileSize } from '@shared/utils'

import { SceneAssetsSection } from './scene-assets-section'
import { SceneMetricsSection } from './scene-metrics-section'
import { SceneSurfaceDrawer } from './scene-surface-drawer'

import type { SerializedSceneAssetDataMap } from '../../../types/api'
import type { SceneDetailsSummary } from '../../../types/dashboard'

interface SceneDetailsSheetProps {
	details: SceneDetailsSummary
	assetData?: SerializedSceneAssetDataMap | null
	className?: string
}

/** What the door says before it is opened. */
function describeContents(details: SceneDetailsSummary): string {
	if (details.assetCount === 0) {
		return 'No linked assets'
	}

	const assets = `${details.assetCount} ${details.assetCount === 1 ? 'asset' : 'assets'}`
	/*
	  `formatFileSize` does not take a null yet - the unification that widens it
	  stacks on top of this branch - so the size is dropped rather than printed as
	  a bare dash beside a real count.
	*/
	return typeof details.fileSizeBytes === 'number'
		? `${assets} · ${formatFileSize(details.fileSizeBytes)}`
		: assets
}

/**
 * What the scene *is*, for viewports with no room for an aside.
 *
 * The same two sections the aside renders - not copies of them. That is a
 * second host for one definition, which is what `EmbedOptionsPanel` already
 * has; two definitions with labels that drift apart is what the surface split
 * removed and what must not return.
 *
 * `headingLevel="h3"` because `DrawerTitle` is the `h2` above them here, where
 * in the aside they are the top of the page's outline.
 */
export function SceneDetailsSheet({
	details,
	assetData,
	className
}: SceneDetailsSheetProps) {
	return (
		<SceneSurfaceDrawer
			label="Scene details"
			summary={describeContents(details)}
			description="What this scene weighs, and what it is made of."
			triggerClassName={className}
		>
			<SceneMetricsSection details={details} headingLevel="h3" />
			<SceneAssetsSection
				assets={details.assets}
				assetData={assetData}
				headingLevel="h3"
			/>
		</SceneSurfaceDrawer>
	)
}
