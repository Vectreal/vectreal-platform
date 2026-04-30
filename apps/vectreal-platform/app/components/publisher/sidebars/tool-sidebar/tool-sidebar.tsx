import { Button } from '@shared/components/ui/button'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { cn } from '@shared/utils'
import { User } from '@supabase/supabase-js'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { memo, useCallback } from 'react'

import {
	processAtom,
	toolSidebarStateAtom
} from '../../../../lib/stores/publisher-config-store'
import { ComposeSidebar } from '../compose-sidebar'
import {
	COMPOSE_TOOL_DEFINITIONS,
	getComposeToolDefinition
} from '../compose-sidebar/compose-tools'
import { DynamicSidebar } from '../dynamic-sidebar'

import type { ComposeTool } from '../../../../types/publisher-config'

// ---------------------------------------------------------------------------
// ToolSidebar
// ---------------------------------------------------------------------------

interface ToolSidebarProps {
	user: User | null
	isMobile?: boolean
}

export const ToolSidebar = memo(
	({ user, isMobile = false }: ToolSidebarProps) => {
		const { activeComposeTool, showSidebar } =
			useAtomValue(toolSidebarStateAtom)
		const setProcessState = useSetAtom(processAtom)
		const activeToolDefinition = getComposeToolDefinition(activeComposeTool)

		const handleToolSelect = useCallback(
			(tool: ComposeTool) => {
				setProcessState((prev) => ({
					...prev,
					mode: 'compose',
					activeComposeTool: tool,
					showSidebar:
						prev.activeComposeTool === tool ? !prev.showSidebar : true,
					showPublishPanel: false
				}))
			},
			[setProcessState]
		)

		const handleOpenChange = useCallback(
			(open: boolean) => {
				setProcessState((prev) =>
					prev.showSidebar === open ? prev : { ...prev, showSidebar: open }
				)
			},
			[setProcessState]
		)

		const desktopToolRail = (
			<div className="fixed top-0 left-0 z-40 m-3 hidden flex-col gap-2 md:flex">
				{COMPOSE_TOOL_DEFINITIONS.map(({ value, icon: Icon, shortLabel }) => {
					const isActive = value === activeComposeTool && showSidebar

					return (
						<Tooltip key={value}>
							<TooltipTrigger asChild>
								<Button
									variant={isActive ? 'secondary' : 'ghost'}
									size="icon"
									aria-label={shortLabel}
									aria-pressed={isActive}
									className={cn('h-10 w-10 rounded-2xl transition-all', {
										'bg-background ring-border/60 shadow-lg ring-1': isActive,
										'hover:bg-background/80 hover:ring-border/40 hover:ring-1':
											!isActive
									})}
									onClick={() => handleToolSelect(value)}
								>
									<Icon className="text-muted-foreground h-5 w-5" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="right" sideOffset={10}>
								{shortLabel}
							</TooltipContent>
						</Tooltip>
					)
				})}
			</div>
		)

		const mobileToolBar = (
			<div className="bg-muted/50 fixed top-0 left-0 z-40 m-4 flex gap-1 rounded-2xl p-1 shadow-xl backdrop-blur-2xl md:hidden">
				{COMPOSE_TOOL_DEFINITIONS.map(({ value, icon: Icon, shortLabel }) => {
					const isActive = value === activeComposeTool && showSidebar

					return (
						<Button
							key={value}
							variant={isActive ? 'default' : 'secondary'}
							size="icon"
							aria-label={shortLabel}
							aria-pressed={isActive}
							className="h-10 w-10 rounded-xl"
							onClick={() => handleToolSelect(value)}
						>
							<Icon className="h-4 w-4" />
						</Button>
					)
				})}
			</div>
		)

		return (
			<>
				{desktopToolRail}
				{mobileToolBar}

				<DynamicSidebar
					open={showSidebar}
					onOpenChange={handleOpenChange}
					isMobile={isMobile}
					direction="left"
					title={activeToolDefinition.label}
					description={activeToolDefinition.description}
					showDesktopHeader={true}
					className={cn({ 'ml-[3rem] w-[21rem]': !isMobile })}
				>
					<div
						className={cn(
							'no-scrollbar min-h-0 flex-1 overflow-auto px-4 pt-4 pb-5'
						)}
					>
						<ComposeSidebar activeTool={activeComposeTool} />
					</div>
				</DynamicSidebar>
			</>
		)
	}
)
