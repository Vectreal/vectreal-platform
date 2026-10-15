import { Button } from '@shared/components/ui/button'
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { cn } from '@shared/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { SparklesIcon } from 'lucide-react'

import type { FC } from 'react'

interface OptimizeButtonProps {
	onOptimize: () => Promise<boolean | void>
	isPending: boolean
	label: string
	buttonClassName?: string
	isPreparing?: boolean
	disabled?: boolean
}

const OPTIMIZER_PREPARING_TOOLTIP =
	'Preparing the optimizer. Every preset starts from your original model, so switching presets never builds on a previous result.'

/** Applies the settings the panel shows to the original model. */
export const OptimizeButton: FC<OptimizeButtonProps> = ({
	label,
	buttonClassName,
	isPending,
	isPreparing = false,
	disabled,
	onOptimize
}) => {
	const button = (
		<Button
			type="button"
			className={cn('grow', buttonClassName)}
			onClick={onOptimize}
			disabled={isPending || disabled}
		>
			<AnimatePresence mode="wait">
				{isPending ? (
					<motion.div
						key="optimize-button-loading"
						className="flex items-center justify-center gap-2 text-center"
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
						className="inline-flex items-center gap-2"
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 10 }}
						transition={{ duration: 0.3 }}
					>
						<SparklesIcon className="h-4 w-4" />
						{label}
					</motion.div>
				)}
			</AnimatePresence>
		</Button>
	)

	return (
		<div className="flex grow">
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
	)
}
