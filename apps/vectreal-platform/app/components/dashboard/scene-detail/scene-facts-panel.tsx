import { cn } from '@shared/utils'

import { SceneAssetsSection } from './scene-assets-section'
import { SceneDeleteButton } from './scene-delete-button'
import { SceneMetricsSection } from './scene-metrics-section'
import { ScenePublishPanel } from './scene-publish-panel'

import type { DashboardEntityRef } from '../../../lib/domain/dashboard/dashboard-confirmation'
import type { ScenePublishStateResponse } from '../../../types/api'
import type { SerializedSceneAssetDataMap } from '../../../types/api'
import type { SceneDetailsSummary } from '../../../types/dashboard'

interface SceneFactsPanelProps {
	details: SceneDetailsSummary
	assetData?: SerializedSceneAssetDataMap | null
	sceneId: string
	projectId: string
	publishState: ScenePublishStateResponse
	publisherPath: string
	onPublish: () => void
	deleteRef: DashboardEntityRef
	canDelete: boolean
	onDeleted: () => void
	className?: string
}

/**
 * What the scene *is*: what it weighs, and what it is made of.
 *
 * The `xl` column, and only that. Below `xl` this content is reached through
 * `SceneSummaryBar` instead: flowing the full list into the page made it taller
 * than the shell could scroll and left it clipped.
 *
 * Three surfaces, in the order the questions get asked - what it weighs, what
 * it is made of, and what you can do with it. The asset list takes the space
 * between the other two and scrolls inside it, so the door at the foot stays
 * on screen however many assets a scene has.
 *
 * `w-detail-panel`, the same token the publish drawer and the publisher sidebar
 * read. The 20rem this column used to be was a bare bracket value that agreed
 * with nothing.
 */
export function SceneFactsPanel({
	details,
	assetData,
	sceneId,
	projectId,
	publishState,
	publisherPath,
	onPublish,
	deleteRef,
	canDelete,
	onDeleted,
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
				'ds-raised hidden min-h-0 flex-col gap-3 overflow-hidden rounded-2xl p-5',
				'w-detail-panel xl:flex',
				className
			)}
		>
			{/*
			  Publishing leads the column. It was a quiet door at the foot, under
			  the metrics and the asset list, which is the wrong order for a page
			  whose whole purpose is getting a scene onto someone else's site.
			*/}
			{/*
			  `mb-3` on top of the column's own `gap-3`: a full step of air under
			  publishing, so the column reads as two groups - what you do with the
			  scene, then what the scene is - rather than one undifferentiated stack.
			*/}
			<ScenePublishPanel
				className="mb-3"
				sceneId={sceneId}
				projectId={projectId}
				publishState={publishState}
				publisherPath={publisherPath}
				onPublish={onPublish}
			/>

			<SceneMetricsSection details={details} />
			{/*
			  `min-h-0` is what lets this shrink below its content and scroll rather
			  than pushing the trigger below it out of the panel: a flex item's floor
			  is its content height until something says otherwise.
			*/}
			<SceneAssetsSection
				assets={details.assets}
				assetData={assetData}
				className="min-h-0 overflow-y-auto"
			/>
			{/*
			  Last and quietest. Delete is not what this surface is for; it just has
			  to live somewhere findable that is not the header, where it read as a
			  fourth call to action.
			*/}
			<SceneDeleteButton
				sceneId={sceneId}
				deleteRef={deleteRef}
				canDelete={canDelete}
				onDeleted={onDeleted}
			/>
		</aside>
	)
}
