import { Button } from '@shared/components/ui/button'
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { AnimatePresence, motion } from 'framer-motion'
import { SparklesIcon } from 'lucide-react'

import type { ComponentProps, FC } from 'react'

type OptimizeButtonMode = 'apply' | 'optimize-more'
type OptimizeButtonHierarchy = 'primary' | 'secondary'

interface OptimizeButtonProps {
	onOptimize: () => Promise<boolean | void>
	isPending: boolean
	hasOptimized?: boolean
	mode?: OptimizeButtonMode
	hierarchy?: OptimizeButtonHierarchy
	label?: string
	buttonVariant?: ComponentProps<typeof Button>['variant']
	buttonClassName?: string
	isPreparing?: boolean
	disabled?: boolean
	fixedBottom?: boolean
}

const OPTIMIZER_PREPARING_TOOLTIP =
	'Preparing optimizer. Once ready, you can apply optimizations to improve performance and file size. If you ever want to return to the original source after applying them, simply re-upload the model.'

export const OptimizeButton: FC<OptimizeButtonProps> = ({
	hasOptimized,
	mode,
	hierarchy = 'primary',
	label,
	buttonVariant,
	buttonClassName,
	isPending,
	isPreparing = false,
	disabled,
	fixedBottom = true,
	onOptimize
}) => {
	const resolvedMode = mode ?? (hasOptimized ? 'optimize-more' : 'apply')
	const resolvedVariant =
		buttonVariant ?? (hierarchy === 'secondary' ? 'secondary' : 'default')
	const buttonLabel =
		label ??
		(resolvedMode === 'optimize-more' ? 'Optimize More' : 'Apply Optimizations')

	const button = (
		<span className={fixedBottom ? 'm-2 flex grow' : 'flex grow'}>
			<Button
				variant={resolvedVariant}
				className={`grow ${buttonClassName ?? ''}`.trim()}
				onClick={onOptimize}
				disabled={isPending || disabled}
			>
				<AnimatePresence mode="wait">
					{isPending ? (
						<motion.div
							key="optimize-button-loading"
							layout-id="optimize-button"
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
							layout-id="optimize-button"
							className="inline-flex items-center gap-2"
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 10 }}
							transition={{ duration: 0.3 }}
						>
							<SparklesIcon className="h-4 w-4" />
							{buttonLabel}
						</motion.div>
					)}
				</AnimatePresence>
			</Button>
		</span>
	)

	return (
		<>
			{fixedBottom && <div className="h-9" />}

			<div
				className={
					fixedBottom
						? 'bg-shell-overlay border-shell-border-soft fixed bottom-0 left-0 z-10 flex w-full border-t shadow-2xl backdrop-blur-2xl'
						: 'flex w-full'
				}
			>
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
