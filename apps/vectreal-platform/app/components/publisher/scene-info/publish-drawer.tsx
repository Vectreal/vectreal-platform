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

import { PublishSidebarContent } from '../sidebars/publish-sidebar'

import type { SceneStatsData } from '../../../types/api'
import type { OptimizationReport } from '@vctrl/core'

interface PublishDrawerProps {
	open: boolean
	onOpenChange: (nextOpen: boolean) => void
	userId?: string
	sceneId?: string
	projectId?: string
	saveSceneSettings: () => Promise<
		| { sceneId?: string; unchanged?: boolean; [key: string]: unknown }
		| { unchanged: true }
		| undefined
	>
	info: OptimizationInfo
	report?: OptimizationReport | null
	publishedAt?: string | null
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
	userId,
	sceneId,
	projectId,
	saveSceneSettings,
	info,
	report,
	publishedAt,
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
					userId={userId}
					sceneId={sceneId}
					projectId={projectId}
					saveSceneSettings={saveSceneSettings}
					info={info}
					report={report}
					publishedAt={publishedAt}
					sizeInfo={sizeInfo}
					stats={stats}
				/>
			</DrawerContent>
		</Drawer>
	)
}
