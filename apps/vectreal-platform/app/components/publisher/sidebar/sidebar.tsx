import { User } from '@supabase/supabase-js'
import { VectrealLogoSmall } from '@vctrl-ui/assets/icons/vectreal-logo-small'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@vctrl-ui/ui/tabs'
import { TooltipProvider } from '@vctrl-ui/ui/tooltip'
import { cn } from '@vctrl-ui/utils'
import { motion } from 'framer-motion'
import { AnimatePresence } from 'framer-motion'
import { useAtom } from 'jotai/react'
import { BarChart4, Camera, SidebarIcon } from 'lucide-react'
import { useCallback } from 'react'
import { Link } from 'react-router'

import {
	processAtom,
	SidebarMode
} from '../../../lib/stores/publisher-config-store'
import { TooltipButton } from '../../tooltip-button'

import { ComposeSidebar } from './compose-sidebar'
import { OptimizeSidebar } from './optimize-sidebar'
import { PublishSidebar } from './publish-sidebar'
import { SceneNameInput } from './scene-name-input'

const SidebarTabs = ({
	mode,
	onTabChange
}: {
	mode: SidebarMode
	onTabChange: (value: string) => void
}) => (
	<Tabs
		value={mode}
		onValueChange={onTabChange}
		className="m-2 h-full overflow-hidden"
	>
		<TabsList className="bg-muted/25 w-full shadow-2xl">
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
			<OptimizeSidebar />
		</TabsContent>
		<TabsContent
			value="compose"
			className="no-scrollbar space-y-2 overflow-auto rounded-xl"
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
}

const PublisherSidebar = ({ user }: PublisherSidebarProps) => {
	const [{ mode, step, showSidebar }, setProcessState] = useAtom(processAtom)

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

	return (
		<TooltipProvider>
			<div className="fixed left-0 z-20 flex h-full flex-col justify-end">
				<AnimatePresence mode="wait">
					<motion.div
						key="sidebar"
						initial="hidden"
						animate={showSidebar ? 'visible' : 'hidden'}
						exit="exit"
						variants={variants}
						transition={{ type: 'ease', duration: 0.3 }}
						className="bg-muted/50 relative m-4 h-full w-92 flex-col overflow-hidden rounded-xl backdrop-blur-2xl"
					>
						<div className="flex w-full items-center gap-2 pl-4">
							<Link to="/dashboard" className="group">
								<VectrealLogoSmall className="h-5 w-5 transition-opacity group-hover:opacity-70" />
							</Link>
							<SceneNameInput />
						</div>

						{step === 'preparing' && (
							<SidebarTabs mode={mode} onTabChange={handleTabChange} />
						)}
						{step === 'publishing' && (
							<PublishSidebar
								userId={user?.id}
								sceneId={undefined} // TODO: Get from scene context
								projectId={undefined} // TODO: Get from project context
							/>
						)}
					</motion.div>
				</AnimatePresence>
			</div>

			<div
				className={cn(
					'fixed top-0 z-20 m-4 flex gap-2 transition-all',
					showSidebar ? 'left-94' : 'left-0'
				)}
			>
				{!showSidebar && (
					<TooltipButton info="Go to your dashboard" size="icon">
						<Link to="/dashboard" className="group">
							<VectrealLogoSmall className="text-muted-foreground ml-[2px] h-5 w-5 transition-opacity group-hover:opacity-70" />
						</Link>
					</TooltipButton>
				)}

				<TooltipButton
					size="icon"
					info="Toggle Sidebar"
					onClick={toggleSidebar}
				>
					<SidebarIcon className="text-muted-foreground h-5 w-5" />
				</TooltipButton>
			</div>
		</TooltipProvider>
	)
}

export default PublisherSidebar
