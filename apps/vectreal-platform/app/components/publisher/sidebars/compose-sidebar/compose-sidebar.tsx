import { AnimatePresence, motion } from 'framer-motion'
import { memo, useMemo } from 'react'

import { getComposeToolDefinition } from './compose-tools'

import type { ComposeTool } from '../../../../types/publisher-config'

/**
 * ComposeSidebarContent component
 *
 * Following React best practices:
 * - rendering-hoist-jsx: Static section configs hoisted outside
 * - rerender-memo: Memoized to prevent unnecessary re-renders
 */
interface ComposeSidebarContentProps {
	activeTool: ComposeTool
}

const ComposeSidebarContent = memo(
	({ activeTool }: ComposeSidebarContentProps) => {
		const toolDefinition = useMemo(
			() => getComposeToolDefinition(activeTool),
			[activeTool]
		)
		const ToolIcon = toolDefinition.icon
		const ToolComponent = toolDefinition.component

		return (
			<div className="space-y-4">
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={activeTool}
						initial={{ opacity: 0, y: 14 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.18, ease: 'easeOut' }}
						className="space-y-4"
					>
						<div className="sr-only">{toolDefinition.label}</div>
						<ToolComponent />
					</motion.div>
				</AnimatePresence>
			</div>
		)
	}
)

ComposeSidebarContent.displayName = 'ComposeSidebarContent'

export default ComposeSidebarContent
