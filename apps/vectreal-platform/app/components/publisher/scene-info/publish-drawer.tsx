import { Button } from '@shared/components/ui/button'
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle
} from '@shared/components/ui/drawer'
import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import { X } from 'lucide-react'
import { type FC } from 'react'

import { SaveAvailabilityState } from '../../../hooks'
import { PublishSidebarContent } from '../sidebars/publish-sidebar'

import type { SceneStatsData } from '../../../types/api'
import type { OptimizationReport } from '@vctrl/core'

interface PublishDrawerProps {
	open: boolean
	onOpenChange: (nextOpen: boolean) => void
	sceneId?: string
	projectId?: string
	userId?: string
	onRequireAuth?: () => Promise<void> | void
	saveSceneSettings: () => Promise<
		| { sceneId?: string; unchanged?: boolean; [key: string]: unknown }
		| { unchanged: true }
		| undefined
	>
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

export const PublishDrawer: FC<PublishDrawerProps> = ({
	open,
	onOpenChange,
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
}) => {
	return (
		<Drawer open={open} onOpenChange={onOpenChange} direction="right">
			<DrawerContent className="after:none data-[vaul-drawer-direction=right]:sm:bg-muted/50 data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:top-4 data-[vaul-drawer-direction=right]:sm:right-4 data-[vaul-drawer-direction=right]:sm:bottom-4 data-[vaul-drawer-direction=right]:sm:h-auto data-[vaul-drawer-direction=right]:sm:w-92 data-[vaul-drawer-direction=right]:sm:max-w-none data-[vaul-drawer-direction=right]:sm:rounded-xl data-[vaul-drawer-direction=right]:sm:border-0 data-[vaul-drawer-direction=right]:sm:shadow-2xl data-[vaul-drawer-direction=right]:sm:backdrop-blur-2xl data-[vaul-drawer-direction=right]:sm:after:opacity-0">
				<DrawerHeader className="border-b">
					<div className="flex items-start justify-between gap-2">
						<div>
							<DrawerTitle>Scene Info & Publish</DrawerTitle>
							<DrawerDescription>
								Save, publish, and embed your latest scene.
							</DrawerDescription>
						</div>
						<DrawerClose asChild>
							<Button variant="ghost" size="icon">
								<X className="h-4 w-4" />
							</Button>
						</DrawerClose>
					</div>
				</DrawerHeader>

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
			</DrawerContent>
		</Drawer>
	)
}
