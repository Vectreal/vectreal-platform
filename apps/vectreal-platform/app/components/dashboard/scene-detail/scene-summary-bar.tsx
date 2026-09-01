import { cn, formatFileSize } from '@shared/utils'

import { SceneDeleteButton } from './scene-delete-button'
import { SceneDetailsSheet } from './scene-details-sheet'
import { SceneShareDrawer } from './scene-share-drawer'
import { StatGrid, StatTile } from '../../layout-components'

import type { DashboardEntityRef } from '../../../lib/domain/dashboard/dashboard-confirmation'
import type { ScenePublishStateResponse } from '../../../types/api'
import type { SerializedSceneAssetDataMap } from '../../../types/api'
import type { SceneDetailsSummary } from '../../../types/dashboard'

interface SceneSummaryBarProps {
	details: SceneDetailsSummary
	assetData?: SerializedSceneAssetDataMap | null
	sceneId: string
	projectId: string
	publishState: ScenePublishStateResponse
	onPublish: () => void
	deleteRef: DashboardEntityRef
	canDelete: boolean
	onDeleted: () => void
	className?: string
}

/**
 * The aside, for viewports that have no room for one.
 *
 * Below `xl` the facts panel used to flow into the page as a full asset list,
 * which made the page taller than the shell could scroll and left the list
 * clipped and unreachable. It also put a twelve-row list between the scene and
 * anything a phone user came here to do.
 *
 * Two numbers and two doors instead. Size and assets are the figures that drive
 * every decision on this page, so they stay on screen; everything else is one
 * tap away and mounts only when asked for.
 */
export function SceneSummaryBar({
	details,
	assetData,
	sceneId,
	projectId,
	publishState,
	onPublish,
	deleteRef,
	canDelete,
	onDeleted,
	className
}: SceneSummaryBarProps) {
	return (
		<aside
			aria-label="Scene summary"
			className={cn('ds-raised flex flex-col gap-3 rounded-2xl p-5', className)}
		>
			{/*
			  `StatTile` at full weight rather than a text row. These two are the
			  page's headline figures on a phone, and the tile is what the aside uses
			  for them at every other width.
			*/}
			<StatGrid>
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

			<SceneDetailsSheet details={details} assetData={assetData} />
			<SceneShareDrawer
				sceneId={sceneId}
				projectId={projectId}
				publishState={publishState}
				onPublish={onPublish}
			/>
			{/* Under the doors, and quieter than either. See the facts panel. */}
			<SceneDeleteButton
				sceneId={sceneId}
				deleteRef={deleteRef}
				canDelete={canDelete}
				onDeleted={onDeleted}
			/>
		</aside>
	)
}
