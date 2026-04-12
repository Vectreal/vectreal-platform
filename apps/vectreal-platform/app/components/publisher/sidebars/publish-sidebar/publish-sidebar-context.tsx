import {
	createContext,
	type FC,
	type PropsWithChildren,
	useContext
} from 'react'

import { type PublishSidebarViewModel } from './publish-sidebar-view-model'
import { type SaveAvailabilityState, type SaveSceneFn } from '../../../../hooks'

export interface PublishSidebarContextValue {
	sceneId?: string
	projectId?: string
	userId?: string
	onOpenOptimizationModal?: () => void
	canReoptimize?: boolean
	onRequireAuth?: () => Promise<void> | void
	saveSceneSettings: SaveSceneFn
	saveAvailability: SaveAvailabilityState
	viewModel: PublishSidebarViewModel
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
