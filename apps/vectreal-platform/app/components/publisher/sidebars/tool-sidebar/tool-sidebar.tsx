import { usePostHog } from '@posthog/react'
import { VectrealLogoSmall } from '@shared/components/assets/icons/vectreal-logo-small'
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger
} from '@shared/components/ui/tabs'
import { TooltipProvider } from '@shared/components/ui/tooltip'
import { cn } from '@shared/utils'
import { User } from '@supabase/supabase-js'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { BarChart4, Camera, SidebarIcon } from 'lucide-react'
import { memo, useCallback } from 'react'
import { Link, useFetcher } from 'react-router'

import {
	processAtom,
	toolSidebarStateAtom
} from '../../../../lib/stores/publisher-config-store'
import { SidebarMode } from '../../../../types/publisher-config'
import { TooltipButton } from '../../../tooltip-button'
import { UserMenu } from '../../../user-menu'
import { ComposeSidebar } from '../compose-sidebar'
import { DynamicSidebar } from '../dynamic-sidebar'
import { OptimizeSidebar } from '../optimize-sidebar'
import { SceneNameAndLocation } from '../scene-name-and-location'

// ---------------------------------------------------------------------------
// Tabs (shared between desktop panel and mobile drawer)
// ---------------------------------------------------------------------------

const ToolSidebarTabs = ({
	mode,
	userId,
	onTabChange,
	className
}: {
	mode: SidebarMode
	userId?: string
	onTabChange: (value: string) => void
	className?: string
}) => (
	<Tabs
		value={mode}
		onValueChange={onTabChange}
		className={cn('flex flex-col overflow-hidden', className)}
	>
		<div className="shrink-0 px-2 pt-2">
			<TabsList className="w-full shadow-2xl">
				<TabsTrigger value="optimize">
					<BarChart4 /> Optimize
				</TabsTrigger>
				<TabsTrigger value="compose">
					<Camera />
					Compose
				</TabsTrigger>
			</TabsList>
		</div>
		<TabsContent
			value="optimize"
			className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-auto rounded-xl px-2 pb-6"
		>
			<OptimizeSidebar userId={userId} />
		</TabsContent>
		<TabsContent
			value="compose"
			className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-auto rounded-xl px-2 pb-6"
		>
			<ComposeSidebar />
		</TabsContent>
	</Tabs>
)

// ---------------------------------------------------------------------------
// ToolSidebar
// ---------------------------------------------------------------------------

interface ToolSidebarProps {
	user: User | null
	isMobile?: boolean
}

export const ToolSidebar = memo(
	({ user, isMobile = false }: ToolSidebarProps) => {
		const { mode, showSidebar } = useAtomValue(toolSidebarStateAtom)
		const setProcessState = useSetAtom(processAtom)
		const { submit } = useFetcher()
		const posthog = usePostHog()

		const handleTabChange = useCallback(
			(value: string) => {
				const nextMode = value as SidebarMode
				setProcessState((prev) =>
					prev.mode === nextMode ? prev : { ...prev, mode: nextMode }
				)
			},
			[setProcessState]
		)

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

		const handleLogout = useCallback(async () => {
			posthog?.reset()
			await submit(null, { method: 'post', action: '/auth/logout' })
		}, [posthog, submit])

		const headerContent = (
			<>
				{user ? (
					<UserMenu size="sm" user={user} onLogout={handleLogout} />
				) : (
					<TooltipButton className="p-1" info="Go to dashboard">
						<Link to="/dashboard">
							<VectrealLogoSmall className="text-muted-foreground h-5 w-5" />
						</Link>
					</TooltipButton>
				)}
				<SceneNameAndLocation authenticated={!!user} />
			</>
		)

		return (
			<TooltipProvider>
				<DynamicSidebar
					open={showSidebar}
					onOpenChange={handleOpenChange}
					isMobile={isMobile}
					direction="left"
					title="Scene Tools"
					description="Optimize and compose your 3D scene"
				>
					{/* Header row: profile menu + scene name/location */}
					<div className="flex w-full shrink-0 items-start gap-2 p-2 pb-0">
						{headerContent}
					</div>

					<ToolSidebarTabs
						mode={mode}
						userId={user?.id}
						onTabChange={handleTabChange}
						className="flex-1"
					/>
				</DynamicSidebar>

				{/* Toggle button (floats at top-left, shifts right when open) */}
				<div
					className={cn(
						'fixed top-0 z-20 m-4 flex gap-2 transition-all',
						showSidebar && !isMobile ? 'left-[23.5rem]' : 'left-0'
					)}
				>
					<TooltipButton
						className="group"
						size="icon"
						info="Toggle Sidebar"
						onClick={toggleSidebar}
					>
						<SidebarIcon className="text-muted-foreground h-5 w-5 transition-opacity group-hover:opacity-70" />
					</TooltipButton>
				</div>
			</TooltipProvider>
		)
	}
)
