import { Button } from '@shared/components/ui/button'
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { AnimatePresence, motion } from 'framer-motion'
import { SparklesIcon } from 'lucide-react'

import type { FC } from 'react'

interface OptimizeButtonProps {
	onOptimize: () => Promise<void>
	isPending: boolean
	hasOptimized: boolean
	disabled?: boolean
}

export const OptimizeButton: FC<OptimizeButtonProps> = ({
	hasOptimized,
	isPending,
	disabled,
	onOptimize
}) => (
	<>
		<div className="h-9" />

		<div className="bg-muted/50 fixed bottom-0 left-0 z-10 flex w-full shadow-2xl backdrop-blur-xl">
			<Button
				variant="secondary"
				className="m-2 grow rounded-lg"
				onClick={onOptimize}
				disabled={isPending || disabled}
			>
				<AnimatePresence mode="wait">
					{isPending ? (
						<motion.div
							key="optimize-button-loading"
							layout-id="optimize-button"
							className="bg-muted flex items-center justify-center gap-2 rounded-md p-4 text-center"
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 10 }}
							transition={{ duration: 0.5 }}
						>
							<LoadingSpinner className="h-4 w-4" />
							Optimizing...
						</motion.div>
					) : (
						<motion.div
							key="optimize-button-content"
							layout-id="optimize-button"
							className="inline-flex items-center gap-2"
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 10 }}
							transition={{ duration: 0.3 }}
						>
							<SparklesIcon className="h-4 w-4" />
							{hasOptimized ? 'Optimize More' : 'Apply Optimizations'}
						</motion.div>
					)}
				</AnimatePresence>
			</Button>
		</div>
	</>
)
