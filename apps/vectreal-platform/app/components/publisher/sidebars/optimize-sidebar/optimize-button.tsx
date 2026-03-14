import { Button } from '@shared/components/ui/button'
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { AnimatePresence, motion } from 'framer-motion'
import { SparklesIcon } from 'lucide-react'

import type { FC } from 'react'

interface OptimizeButtonProps {
	onOptimize: () => Promise<void>
	isPending: boolean
	hasOptimized: boolean
	isPreparing?: boolean
	disabled?: boolean
}

const OPTIMIZER_PREPARING_TOOLTIP =
	'Preparing optimizer. Once ready, you can apply optimizations to improve performance and file size. If you ever want to return to the original source after applying them, simply re-upload the model.'

export const OptimizeButton: FC<OptimizeButtonProps> = ({
	hasOptimized,
	isPending,
	isPreparing = false,
	disabled,
	onOptimize
}) => {
	const button = (
		<span className="m-2 flex grow">
			<Button
				variant="secondary"
				className="grow rounded-lg"
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
		</span>
	)

	return (
		<>
			<div className="h-9" />

			<div className="bg-muted/50 fixed bottom-0 left-0 z-10 flex w-full shadow-2xl backdrop-blur-xl">
				{isPreparing ? (
					<Tooltip>
						<TooltipTrigger asChild>{button}</TooltipTrigger>
						<TooltipContent className="max-w-80" sideOffset={6}>
							{OPTIMIZER_PREPARING_TOOLTIP}
						</TooltipContent>
					</Tooltip>
				) : (
					button
				)}
			</div>
		</>
	)
}
