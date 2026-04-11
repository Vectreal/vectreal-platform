import { type OptimizationReport } from '@vctrl/core'
import { type OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import {
	createContext,
	type FC,
	type PropsWithChildren,
	useContext
} from 'react'

import { type SaveAvailabilityState, type SaveSceneFn } from '../../../../hooks'
import { type SceneStatsData } from '../../../../types/api'

export interface PublishSidebarContextValue {
	sceneId?: string
	projectId?: string
	userId?: string
	onOpenOptimizationModal?: () => void
	canReoptimize?: boolean
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

const PublishSidebarContext = createContext<PublishSidebarContextValue | null>(
	null
)

interface PublishSidebarProviderProps extends PropsWithChildren {
	value: PublishSidebarContextValue
}

export const PublishSidebarProvider: FC<PublishSidebarProviderProps> = ({
	value,
	children
}) => (
	<PublishSidebarContext.Provider value={value}>
		{children}
	</PublishSidebarContext.Provider>
)

export const usePublishSidebarContext = (): PublishSidebarContextValue => {
	const context = useContext(PublishSidebarContext)

	if (!context) {
		throw new Error(
			'usePublishSidebarContext must be used within a PublishSidebarProvider'
		)
	}

	return context
}
