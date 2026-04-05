import { usePostHog } from '@posthog/react'
import { VectrealLogoSmall } from '@shared/components/assets/icons/vectreal-logo-small'
import { Button } from '@shared/components/ui/button'
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle
} from '@shared/components/ui/drawer'
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger
} from '@shared/components/ui/tabs'
import { TooltipProvider } from '@shared/components/ui/tooltip'
import { cn } from '@shared/utils'
import { User } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { AnimatePresence } from 'framer-motion'
import { useAtom } from 'jotai/react'
import { BarChart4, Camera, SidebarIcon, X } from 'lucide-react'
import { useCallback } from 'react'
import { Link, useFetcher } from 'react-router'

import { ComposeSidebar } from './compose-sidebar'
import { OptimizeSidebar } from './optimize-sidebar'
import { SceneNameAndLocation } from './scene-name-and-location'
import { processAtom } from '../../../lib/stores/publisher-config-store'
import { SidebarMode } from '../../../types/publisher-config'
import { TooltipButton } from '../../tooltip-button'
import { UserMenu } from '../../user-menu'

const SidebarTabs = ({
	mode,
	userId,
	onTabChange
}: {
	mode: SidebarMode
	userId?: string
	onTabChange: (value: string) => void
}) => (
	<Tabs
		value={mode}
		onValueChange={onTabChange}
		className="m-2 h-full overflow-hidden"
	>
		<TabsList className="w-full shadow-2xl">
			<TabsTrigger value="optimize">
				<BarChart4 /> Optimize
			</TabsTrigger>
			<TabsTrigger value="compose">
				<Camera />
				Compose
			</TabsTrigger>
		</TabsList>
		<TabsContent
			value="optimize"
			className="no-scrollbar space-y-2 overflow-auto rounded-xl"
		>
			<OptimizeSidebar userId={userId} />
		</TabsContent>
		<TabsContent
			value="compose"
			className="no-scrollbar space-y-2 overflow-auto rounded-xl"
		>
			<ComposeSidebar />
		</TabsContent>
	</Tabs>
)

const MobileSidebarTabs = ({
	mode,
	userId,
	onTabChange
}: {
	mode: SidebarMode
	userId?: string
	onTabChange: (value: string) => void
}) => (
	<Tabs
		value={mode}
		onValueChange={onTabChange}
		className="flex flex-col overflow-hidden"
	>
		<div className="px-3 pt-3">
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
			className="no-scrollbar space-y-2 overflow-auto rounded-xl px-3 pb-8"
		>
			<OptimizeSidebar userId={userId} />
		</TabsContent>
		<TabsContent
			value="compose"
			className="no-scrollbar space-y-2 overflow-auto rounded-xl px-3 pb-8"
		>
			<ComposeSidebar />
		</TabsContent>
	</Tabs>
)

const variants = {
	hidden: { opacity: 0, x: '-100%', display: 'none' },
	visible: { opacity: 1, x: 0, display: 'flex' },
	exit: { opacity: 0, x: '-100%', dislay: 'none' }
}

interface PublisherSidebarProps {
	user: User | null
	isMobile?: boolean
}

const PublisherSidebar = ({ user, isMobile }: PublisherSidebarProps) => {
	const [{ mode, showSidebar }, setProcessState] = useAtom(processAtom)
	const { submit } = useFetcher()
	const posthog = usePostHog()

	const handleTabChange = useCallback(
		(value: string) => {
			setProcessState((prev) => ({
				...prev,
				mode: value as SidebarMode
			}))
		},
		[setProcessState]
	)

	const toggleSidebar = useCallback(() => {
		setProcessState((prev) => ({
			...prev,
			showSidebar: !prev.showSidebar
		}))
	}, [setProcessState])

	const handleDrawerOpenChange = useCallback(
		(open: boolean) => {
			setProcessState((prev) => ({
				...prev,
				showSidebar: open
			}))
		},
		[setProcessState]
	)

	async function handleLogout() {
		posthog?.reset()
		await submit(null, {
			method: 'post',
			action: '/auth/logout'
		})
	}

	if (isMobile) {
		return (
			<Drawer open={showSidebar} onOpenChange={handleDrawerOpenChange}>
				<DrawerContent className="max-h-[85svh]">
					<DrawerHeader className="border-b pb-3">
						<div className="flex items-start justify-between gap-2">
							<div>
								<DrawerTitle>Scene Tools</DrawerTitle>
								<DrawerDescription>
									Optimize and compose your 3D scene
								</DrawerDescription>
							</div>
							<DrawerClose asChild>
								<Button variant="ghost" size="icon" className="shrink-0">
									<X className="h-4 w-4" />
								</Button>
							</DrawerClose>
						</div>
					</DrawerHeader>
					<MobileSidebarTabs
						mode={mode}
						userId={user?.id}
						onTabChange={handleTabChange}
					/>
				</DrawerContent>
			</Drawer>
		)
	}

	return (
		<TooltipProvider>
			<div className="fixed left-0 z-30 flex h-full flex-col justify-end">
				<AnimatePresence mode="wait">
					<motion.div
						key="sidebar"
						initial="hidden"
						animate={showSidebar ? 'visible' : 'hidden'}
						exit="exit"
						variants={variants}
						transition={{ type: 'ease', duration: 0.3 }}
						className="bg-muted/50 border- relative z-20 m-4 h-full w-92 flex-col overflow-hidden rounded-xl border shadow-xl backdrop-blur-2xl"
					>
						<div className="flex w-full items-start gap-2 p-2 pb-0">
							{user ? (
								<UserMenu size="sm" user={user} onLogout={handleLogout} />
							) : (
								<TooltipButton
									// asChild
									// size="sm"
									className="p-1"
									info="Go to dashboard"
								>
									<Link to="/dashboard">
										<VectrealLogoSmall className="text-muted-foreground h-5 w-5" />
									</Link>
								</TooltipButton>
							)}

							<SceneNameAndLocation authenticated={!!user} />
						</div>

						<SidebarTabs
							mode={mode}
							userId={user?.id}
							onTabChange={handleTabChange}
						/>
					</motion.div>
				</AnimatePresence>
			</div>

			<div
				className={cn(
					'fixed top-0 z-20 m-4 flex gap-2 transition-all',
					showSidebar ? 'left-94' : 'left-0'
				)}
			>
				{!showSidebar && user && (
					<UserMenu size="sm" user={user} onLogout={handleLogout} />
				)}

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

export default PublisherSidebar
