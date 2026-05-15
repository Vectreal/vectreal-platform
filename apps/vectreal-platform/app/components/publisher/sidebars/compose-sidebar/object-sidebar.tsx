import { AnimatePresence, motion } from 'framer-motion'
import { memo, useMemo } from 'react'

import { getObjectToolDefinition } from './object-tools/object-tools'

import type { ObjectTool } from '../../../../types/publisher-config'

interface ObjectSidebarContentProps {
	activeTool: ObjectTool
}

const ObjectSidebar = memo(({ activeTool }: ObjectSidebarContentProps) => {
	const toolDefinition = useMemo(
		() => getObjectToolDefinition(activeTool),
		[activeTool]
	)
	const ToolComponent = toolDefinition.component

	return (
		<div className="space-y-3">
			<AnimatePresence mode="wait" initial={false}>
				<motion.div
					key={activeTool}
					initial={{ opacity: 0, y: 14 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -10 }}
					transition={{ duration: 0.18, ease: 'easeOut' }}
					className="space-y-3"
				>
					<div className="sr-only">{toolDefinition.label}</div>
					<ToolComponent />
				</motion.div>
			</AnimatePresence>
		</div>
	)
})

ObjectSidebar.displayName = 'ObjectSidebar'

export default ObjectSidebar
