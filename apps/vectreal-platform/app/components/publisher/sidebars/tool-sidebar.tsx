import { Button } from '@shared/components/ui/button'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { cn } from '@shared/utils'
import { User } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { memo, useCallback } from 'react'

import { ComposeSidebar } from './compose-sidebar'
import {
	COMPOSE_TOOL_DEFINITIONS,
	getComposeToolDefinition
} from './compose-sidebar/compose-tools'
import { DynamicSidebar } from './dynamic-sidebar'
import {
	arePublisherActionsDisabledAtom,
	isPreviewModeAtom,
	processAtom,
	toolSidebarStateAtom
} from '../../../lib/stores/publisher-config-store'
import {
	PUBLISHER_EDGE_INSET,
	PUBLISHER_LAYER
} from '../shell/shell-layout'

import type { ComposeTool } from '../../../types/publisher-config'

interface ToolSidebarProps {
	user: User | null
	isMobile?: boolean
}

export const ToolSidebar = memo(
	({ user: _user, isMobile = false }: ToolSidebarProps) => {
		const { activeComposeTool, showSidebar } =
			useAtomValue(toolSidebarStateAtom)
		const arePublisherActionsDisabled = useAtomValue(
			arePublisherActionsDisabledAtom
		)
		const isPreviewMode = useAtomValue(isPreviewModeAtom)
		const setProcessState = useSetAtom(processAtom)
		const activeToolDefinition = getComposeToolDefinition(activeComposeTool)

		const handleToolSelect = useCallback(
			(tool: ComposeTool) => {
				if (arePublisherActionsDisabled) {
					return
				}

				setProcessState((prev) => ({
					...prev,
					mode: 'compose',
					activeComposeTool: tool,
					showSidebar:
						prev.activeComposeTool === tool ? !prev.showSidebar : true,
					showPublishPanel: false
				}))
			},
			[arePublisherActionsDisabled, setProcessState]
		)

		const handleOpenChange = useCallback(
			(open: boolean) => {
				if (arePublisherActionsDisabled) {
					return
				}

				setProcessState((prev) =>
					prev.showSidebar === open ? prev : { ...prev, showSidebar: open }
				)
			},
			[arePublisherActionsDisabled, setProcessState]
		)

		return (
			<>
				{/* Anchored to the canvas stage, so the rail starts below the header. */}
				<motion.div
					// Editing tools have no meaning in preview mode, so the rail leaves
					// instead of sitting there disabled.
					animate={
						isPreviewMode ? { opacity: 0, x: -8 } : { opacity: 1, x: 0 }
					}
					transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
					aria-hidden={isPreviewMode}
					className={cn(
						'absolute top-0 left-0 hidden flex-col gap-2 md:flex',
						PUBLISHER_EDGE_INSET,
						PUBLISHER_LAYER.toolRail,
						isPreviewMode && 'pointer-events-none'
					)}
				>
					{COMPOSE_TOOL_DEFINITIONS.map(({ value, icon: Icon, shortLabel }) => {
						const isActive = value === activeComposeTool && showSidebar
						return (
							<Tooltip key={value}>
								<TooltipTrigger asChild>
									<Button
										// Solid in both states, matching every other floating
										// control. The ring and shadow carry the active
										// distinction now that the variant no longer does.
										variant="secondary"
										size="icon"
										aria-label={shortLabel}
										aria-pressed={isActive}
										className={cn('h-10 w-10 rounded-2xl transition-all', {
											'publisher-shell-focus bg-shell-surface ring-shell-border-strong shadow-md ring-1':
												isActive,
											'publisher-shell-focus hover:bg-shell-surface-soft hover:ring-shell-border-soft hover:ring-1':
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
				</motion.div>

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
					<div className="no-scrollbar min-h-0 flex-1 overflow-auto px-4 py-4">
						<ComposeSidebar activeTool={activeComposeTool} />
					</div>
				</DynamicSidebar>
			</>
		)
	}
)
