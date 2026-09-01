import { cn } from '@shared/utils'

import { SceneAssetsSection } from './scene-assets-section'
import { SceneMetricsSection } from './scene-metrics-section'

import type { SerializedSceneAssetDataMap } from '../../../types/api'
import type { SceneDetailsSummary } from '../../../types/dashboard'

interface SceneFactsPanelProps {
	details: SceneDetailsSummary
	assetData?: SerializedSceneAssetDataMap | null
	className?: string
}

/**
 * What the scene *is*: what it weighs, and what it is made of.
 *
 * One element, rendered once. At `xl` it is the aside column and owns its own
 * scroll, because the page there has a definite height it must not exceed.
 * Below `xl` there is no column to be, so it flows into the page and the page
 * scrolls - which is also the first time this content has been reachable on a
 * phone without opening a drawer.
 *
 * `w-detail-panel` from `xl` up, the same token the publish drawer and the
 * publisher sidebar read. The 20rem this column used to be was a bare bracket
 * value that agreed with nothing.
 */
export function SceneFactsPanel({
	details,
	assetData,
	className
}: SceneFactsPanelProps) {
	return (
		/*
		  Named, because below `xl` this landmark is where every metric and every
		  asset now lives, and an anonymous "complementary" is what a screen reader
		  would otherwise announce it as. Every other `aside` in the app carries one.
		*/
		<aside
			aria-label="Scene details"
			className={cn(
				'ds-raised flex flex-col gap-3 rounded-2xl p-5',
				'xl:w-detail-panel xl:min-h-0 xl:overflow-hidden',
				className
			)}
		>
			<SceneMetricsSection details={details} />
			<SceneAssetsSection
				assets={details.assets}
				assetData={assetData}
				className="xl:min-h-0 xl:overflow-y-auto"
			/>
		</aside>
	)
}
