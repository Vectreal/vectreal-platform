import { type OptimizationReport } from '@vctrl/core'
import { type OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import { type FC } from 'react'

import { DynamicSidebar } from '../dynamic-sidebar'
import PublishSidebarContent from './publish-sidebar-content'
import { type SaveAvailabilityState, type SaveSceneFn } from '../../../../hooks'
import { type SceneStatsData } from '../../../../types/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PublishSidebarProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	isMobile?: boolean
	sceneId?: string
	projectId?: string
	userId?: string
	onRequireAuth?: () => Promise<void> | void
	saveSceneSettings: SaveSceneFn
	saveAvailability: SaveAvailabilityState
	info: OptimizationInfo
	report?: OptimizationReport | null
	publishedAt?: string | null
	publishedAssetSizeBytes?: number | null
	sizeInfo: {
		initialSceneBytes?: number | null
		currentSceneBytes?: number | null
		initialTextureBytes?: number | null
		currentTextureBytes?: number | null
	}
	stats?: SceneStatsData | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PublishSidebar: FC<PublishSidebarProps> = ({
	open,
	onOpenChange,
	isMobile = false,
	sceneId,
	projectId,
	userId,
	onRequireAuth,
	saveSceneSettings,
	saveAvailability,
	info,
	report,
	publishedAt,
	publishedAssetSizeBytes,
	sizeInfo,
	stats
}) => (
	<DynamicSidebar
		open={open}
		onOpenChange={onOpenChange}
		isMobile={isMobile}
		direction="right"
		title="Scene Info & Publish"
		description="Save, publish, and embed your latest scene."
		showDesktopHeader
	>
		<PublishSidebarContent
			hideHeader
			showSceneInfo
			sceneId={sceneId}
			projectId={projectId}
			userId={userId}
			onRequireAuth={onRequireAuth}
			saveSceneSettings={saveSceneSettings}
			info={info}
			report={report}
			publishedAt={publishedAt}
			publishedAssetSizeBytes={publishedAssetSizeBytes}
			sizeInfo={sizeInfo}
			stats={stats}
			saveAvailability={saveAvailability}
		/>
	</DynamicSidebar>
)
