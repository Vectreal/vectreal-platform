import { motion } from 'framer-motion'

import { SceneNameInput } from './scene-name-input'
import { StatusIndicator } from './status-indicator'
import { ToolbarProvider } from './toolbar-context'

export function Toolbar() {
	return (
		<ToolbarProvider>
			<motion.div className="relative z-50 mt-10 md:mt-12">
				<motion.div
					layout
					className="flex h-10 w-full min-w-96 items-center overflow-hidden border-b border-neutral-800 bg-neutral-900/80 shadow-lg shadow-black/20 backdrop-blur-md transition-all duration-300"
				>
					<SceneNameInput />
					<div className="h-5 w-px bg-neutral-700/50" aria-hidden="true" />
					<StatusIndicator />
				</motion.div>
			</motion.div>
		</ToolbarProvider>
	)
}
