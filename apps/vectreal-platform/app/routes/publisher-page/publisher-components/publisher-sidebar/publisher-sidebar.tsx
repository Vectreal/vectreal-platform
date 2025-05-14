import { Tabs, TabsContent, TabsList, TabsTrigger } from '@vctrl-ui/ui/tabs'
import { motion } from 'framer-motion'
import { useAtom } from 'jotai/react'

import { ChevronLeft, ChevronRight, X } from 'lucide-react'

import { processAtom } from '../../../../lib/stores/publisher-config-store'

import { OptimizeSidebar } from './optimize-sidebar'

const sidebarVariants = {
	open: {
		opacity: 1,
		width: '400px',
		transition: {
			staggerChildren: 0.2
		}
	},
	closed: {
		opacity: 0,
		width: 0
	}
}

const PublisherSidebar = () => {
	const [{ mode, showSidebar }, setProcessState] = useAtom(processAtom)

	function changeSidebarVisibility(isOpen: boolean) {
		setProcessState((prev) => {
			return {
				...prev,
				showSidebar: isOpen
			}
		})
	}

	function handleTabChange(value: string) {
		setProcessState((prev) => ({
			...prev,
			mode: value as 'optimize' | 'compose' | 'publish'
		}))
	}

	return (
		<motion.div
			variants={sidebarVariants}
			initial="closed"
			animate={showSidebar ? 'open' : 'closed'}
			exit="closed"
			key="sidebar"
			className="relative"
		>
			<aside className="bg-muted/50 z-30 h-full overflow-hidden border-r shadow-xl">
				<Tabs
					value={mode}
					onValueChange={handleTabChange}
					className="h-full w-[400px] gap-0"
				>
					<TabsList className="bg-muted/50 grid h-12 w-full grid-cols-2 rounded-none border-b p-2 shadow-md">
						<TabsTrigger className="cursor-pointer" value="optimize">
							Optimize
						</TabsTrigger>
						<TabsTrigger className="cursor-pointer" value="compose">
							Compose
						</TabsTrigger>
					</TabsList>
					<TabsContent
						key="optimize"
						value="optimize"
						className="relative h-full w-full overflow-auto"
					>
						<OptimizeSidebar />
					</TabsContent>
					<TabsContent value="compose"></TabsContent>
				</Tabs>
			</aside>

			<motion.button
				title="Close sidebar"
				aria-label="Close sidebar"
				aria-hidden={!showSidebar}
				type="button"
				onClick={() => changeSidebarVisibility(!showSidebar)}
				className="border-accent/10 bg-muted/50 text-foreground hover:bg-accent/50 focus-visible:bg-accent/50 absolute top-1/2 -right-6 z-20 mr-[1px] -translate-y-1/2 cursor-pointer rounded-l-none rounded-r-xl border border-l-0 p-4 px-1 backdrop-blur-lg transition-all duration-300"
			>
				<ChevronLeft size={14} />
			</motion.button>
		</motion.div>
	)
}

export default PublisherSidebar
