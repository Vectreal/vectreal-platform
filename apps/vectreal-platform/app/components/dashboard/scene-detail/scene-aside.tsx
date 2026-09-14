import { cn, formatFileSize } from '@shared/utils'

import { SceneAssetsSection } from './scene-assets-section'
import { SceneDeleteButton } from './scene-delete-button'
import { SceneDetailsSheet } from './scene-details-sheet'
import { SceneMetricsSection } from './scene-metrics-section'
import { ScenePublishPanel } from './scene-publish-panel'
import { StatGrid, StatTile } from '../../layout-components'

import type { TextureThumbnailUrls } from '../../../hooks/use-texture-thumbnail-urls'
import type { DashboardEntityRef } from '../../../lib/domain/dashboard/dashboard-confirmation'
import type { ScenePublishStateResponse } from '../../../types/api'
import type { SceneDetailsSummary } from '../../../types/dashboard'

interface SceneAsideProps {
	details: SceneDetailsSummary
	textureUrls?: TextureThumbnailUrls
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
 * What you can do with the scene, and what the scene is.
 *
 * This was two components, `SceneFactsPanel` and `SceneSummaryBar`, mounted
 * side by side with identical eleven-prop call sites and one hidden by CSS at
 * every width. They opened and closed the same way - the same `ds-raised`
 * aside, the same publish panel at the top carrying the same `mb-3` and the
 * same paragraph of comment explaining it, the same delete button at the foot -
 * and differed only in the middle. So the page mounted two publish panels and
 * two delete buttons, each with its own fetcher and its own confirmation
 * dialog, and one of each was never reachable.
 *
 * One aside now. Only the middle changes with the room available:
 *
 * - Below `xl` there is no column, so the two figures that drive every decision
 *   here stay on screen as tiles and everything else is one tap away.
 * - At `xl` and up the column has room for the metrics and the full asset list,
 *   which takes the space between the publish panel and the delete button and
 *   scrolls inside it.
 *
 * **Keeping both middles in the DOM changes nothing about what a phone pays.**
 * The two-host split reads as if it kept the asset list off small screens, and
 * `scene-summary-bar.spec.tsx` pinned that the bar did not render it - but the
 * page mounted `SceneFactsPanel` beside it regardless, `hidden` rather than
 * unmounted, so the list was in the document at every width already. The
 * thumbnails are object URLs over asset bytes the page has loaded anyway, so
 * this is DOM and decode, never a request. What the split did cost was real:
 * two publish panels and two delete buttons per page.
 *
 * The breakpoint stays in CSS deliberately. Choosing a host in JavaScript would
 * need the viewport at render time, which is the hydration flip `mobile-nav.tsx`
 * documents avoiding.
 */
export function SceneAside({
	details,
	textureUrls,
	sceneId,
	projectId,
	publishState,
	publisherPath,
	onPublish,
	deleteRef,
	canDelete,
	onDeleted,
	className
}: SceneAsideProps) {
	return (
		/*
		  Named, because this landmark holds every metric and every asset on the
		  page, and an anonymous "complementary" is what a screen reader would
		  otherwise announce. Every other `aside` in the app carries one.

		  `w-detail-panel` is the same token the publish drawer and the publisher
		  sidebar read; below `xl` the grid is one column and the aside is simply
		  the row under the scene.
		*/
		<aside
			aria-label="Scene details"
			className={cn(
				'ds-raised flex min-h-0 flex-col gap-3 overflow-hidden rounded-2xl p-5',
				'xl:w-detail-panel',
				className
			)}
		>
			{/*
			  Publishing leads, at every width. It was a quiet door at the foot,
			  under the metrics and the asset list, which is the wrong order for a
			  page whose whole purpose is getting a scene onto someone else's site -
			  and on a phone this is the first thing under the scene itself.

			  `mb-3` on top of the column's own `gap-3`: a full step of air under
			  publishing, so the aside reads as two groups - what you do with the
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

			{/*
			  `StatTile` at full weight rather than a text row. These two are the
			  page's headline figures where there is no column, and the tile is what
			  the metrics grid uses for them at every other width.
			*/}
			<StatGrid className="xl:hidden">
				<StatTile
					label="Size"
					value={
						typeof details.fileSizeBytes === 'number'
							? formatFileSize(details.fileSizeBytes)
							: '-'
					}
				/>
				<StatTile label="Assets" value={details.assetCount} />
			</StatGrid>

			<SceneDetailsSheet
				className="xl:hidden"
				details={details}
				textureUrls={textureUrls}
			/>

			<SceneMetricsSection className="hidden xl:block" details={details} />

			{/*
			  `min-h-0` is what lets this shrink below its content and scroll rather
			  than pushing the delete button out of the aside: a flex item's floor is
			  its content height until something says otherwise.
			*/}
			<SceneAssetsSection
				assets={details.assets}
				textureUrls={textureUrls}
				className="hidden min-h-0 overflow-y-auto xl:flex"
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
