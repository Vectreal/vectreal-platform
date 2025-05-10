import { proces } from '@vctrl/platform/lib/stores/publisher-config-store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@vctrl-ui/ui/tabs'
import { motion } from 'framer-motion'
import { useAtom } from 'jotai/react'

import { processAtom } from '../../../../lib/stores/publisher-config-store'

import OptimizeSidebarContent from './optimize-sidebar-content'

const sidebarVariants = {
	open: {
		opacity: 1,
		width: '400px'
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
		showSidebar && (
			<motion.div
				variants={sidebarVariants}
				initial="closed"
				animate={showSidebar ? 'open' : 'closed'}
				exit="closed"
				key="sidebar"
				className="overflow-hidden"
			>
				<Tabs
					value={mode}
					onValueChange={handleTabChange}
					className="w-[400px]"
				>
					<TabsList className="bg-background border-accent/10 grid h-12 w-full grid-cols-2 rounded-none border-b p-2">
						<TabsTrigger value="optimize">Optimize</TabsTrigger>
						<TabsTrigger value="compose">Compose</TabsTrigger>
					</TabsList>
					<TabsContent key="optimize" value="optimize">
						<OptimizeSidebarContent />
					</TabsContent>
					<TabsContent value="compose"></TabsContent>
				</Tabs>
			</motion.div>
		)
	)
}

export default PublisherSidebar
