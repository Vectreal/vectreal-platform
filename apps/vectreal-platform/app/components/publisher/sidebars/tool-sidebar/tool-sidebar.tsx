import { useSidebar } from '@shared/components'
import { TooltipProvider } from '@shared/components/ui/tooltip'
import { cn } from '@shared/utils'
import { User } from '@supabase/supabase-js'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { SidebarIcon } from 'lucide-react'
import { memo, useCallback } from 'react'

import {
	processAtom,
	showSidebarAtom
} from '../../../../lib/stores/publisher-config-store'
import { TooltipButton } from '../../../tooltip-button'
import { ComposeSidebar } from '../compose-sidebar'
import { DynamicSidebar } from '../dynamic-sidebar'
import { SceneNameAndLocation } from '../scene-name-and-location'

// ---------------------------------------------------------------------------
// ToolSidebar
// ---------------------------------------------------------------------------

interface ToolSidebarProps {
	user: User | null
	isMobile?: boolean
}

export const ToolSidebar = memo(
	({ user, isMobile = false }: ToolSidebarProps) => {
		const showSidebar = useAtomValue(showSidebarAtom)
		const setProcessState = useSetAtom(processAtom)
		const { open } = useSidebar()
		const toolbarLabel = !open ? 'Compose' : ''

		const toggleSidebar = useCallback(() => {
			setProcessState((prev) => ({
				...prev,
				showSidebar: !prev.showSidebar
			}))
		}, [setProcessState])

		const handleOpenChange = useCallback(
			(open: boolean) => {
				setProcessState((prev) =>
					prev.showSidebar === open ? prev : { ...prev, showSidebar: open }
				)
			},
			[setProcessState]
		)

		return (
			<TooltipProvider>
				<DynamicSidebar
					open={showSidebar}
					onOpenChange={handleOpenChange}
					isMobile={isMobile}
					direction="left"
					title="Compose Scene"
					description="Adjust lighting, camera, and environment settings"
				>
					{/* Header row: scene name/location */}
					<div className="flex w-full shrink-0 items-start gap-2 p-2 pb-0">
						<SceneNameAndLocation authenticated={!!user} />
					</div>

					<div
						className={cn(
							'no-scrollbar min-h-0 flex-1 space-y-2 overflow-auto rounded-xl px-2 pb-6 pt-2'
						)}
					>
						<ComposeSidebar />
					</div>
				</DynamicSidebar>

				{/* Toggle button (floats at top-left, shifts right when open) */}
				<div
					className={cn(
						'fixed top-0 left-0 z-20 m-4 flex gap-2 transition-all',
						showSidebar && !isMobile ? 'left-[23.5rem]' : 'left-0'
					)}
				>
					<TooltipButton
						className="group"
						size={toolbarLabel ? 'sm' : 'icon'}
						info="Toggle Sidebar"
						onClick={toggleSidebar}
					>
						<SidebarIcon className="text-muted-foreground h-5 w-5 transition-opacity group-hover:opacity-70" />
						{toolbarLabel && (
							<span className="text-sm font-medium">{toolbarLabel}</span>
						)}
					</TooltipButton>
				</div>
			</TooltipProvider>
		)
	}
)
