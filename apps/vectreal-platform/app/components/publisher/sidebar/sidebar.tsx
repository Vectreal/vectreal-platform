import { Tabs, TabsContent, TabsList, TabsTrigger } from '@vctrl-ui/ui/tabs'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtom } from 'jotai/react'
import { ChevronLeft } from 'lucide-react'
import { useCallback } from 'react'

import {
	processAtom,
	SidebarMode
} from '../../../lib/stores/publisher-config-store'

import { ComposeSidebar } from './compose-sidebar'
import { OptimizeSidebar } from './optimize-sidebar'
import { PublishSidebar } from './publish-sidebar'

const SIDEBAR_WIDTH = 400

const sidebarVariants = {
	open: {
		opacity: 1,
		width: `${SIDEBAR_WIDTH}px`,
		transition: { staggerChildren: 0.2 }
	},
	closed: {
		opacity: 0,
		width: 0
	}
}

const sidebarContentVariants = {
	hidden: { opacity: 0 },
	visible: { opacity: 1 }
}

const SidebarMotionAside = ({ children }: React.PropsWithChildren) => (
	<motion.aside
		variants={sidebarContentVariants}
		initial="hidden"
		animate="visible"
		exit="hidden"
		className="h-full overflow-hidden"
	>
		{children}
	</motion.aside>
)

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
		className="h-full w-[400px] gap-0"
	>
		<TabsList className="bg-muted/50 grid h-12 w-full grid-cols-2 rounded-none border-b p-2 shadow-md">
			<TabsTrigger value="optimize">Optimize</TabsTrigger>
			<TabsTrigger value="compose">Compose</TabsTrigger>
		</TabsList>
		<TabsContent
			value="optimize"
			className="no-scrollbar relative overflow-auto"
		>
			<OptimizeSidebar />
		</TabsContent>
		<TabsContent
			value="compose"
			className="no-scrollbar relative overflow-auto"
		>
			<ComposeSidebar />
		</TabsContent>
	</Tabs>
)

const PublisherSidebar = () => {
	const [{ mode, step, showSidebar }, setProcessState] = useAtom(processAtom)

	const changeSidebarVisibility = useCallback(
		(isOpen: boolean) => {
			setProcessState((prev) => ({
				...prev,
				showSidebar: isOpen
			}))
		},
		[setProcessState]
	)

	const handleTabChange = useCallback(
		(value: string) => {
			setProcessState((prev) => ({
				...prev,
				mode: value as SidebarMode
			}))
		},
		[setProcessState]
	)

	return (
		<motion.div
			variants={sidebarVariants}
			initial="closed"
			animate={showSidebar ? 'open' : 'closed'}
			exit="closed"
			key="sidebar"
			className="bg-card/75 absolute top-0 bottom-0 left-0 z-20 border-r shadow-xl backdrop-blur-2xl"
		>
			<AnimatePresence mode="wait">
				{step === 'preparing' && (
					<SidebarMotionAside key="prepare">
						<SidebarTabs mode={mode} onTabChange={handleTabChange} />
					</SidebarMotionAside>
				)}
				{step === 'publishing' && (
					<SidebarMotionAside key="publish">
						<PublishSidebar />
					</SidebarMotionAside>
				)}
			</AnimatePresence>
			<motion.button
				title="Close sidebar"
				aria-label="Close sidebar"
				aria-hidden={!showSidebar}
				type="button"
				onClick={() => changeSidebarVisibility(!showSidebar)}
				className="border-accent/10 bg-muted text-foreground hover:bg-accent/50 focus-visible:bg-accent/50 absolute top-1/2 -right-6 z-20 -translate-y-1/2 rounded-l-none rounded-r-xl border border-l-0 p-4 px-1 shadow-xl transition-all duration-300"
			>
				<ChevronLeft size={14} />
			</motion.button>
		</motion.div>
	)
}

export default PublisherSidebar
