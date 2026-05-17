import { Button } from '@shared/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@shared/components/ui/dropdown-menu'
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDownIcon, SparklesIcon } from 'lucide-react'

import type { FC } from 'react'

type OptimizeButtonMode = 'apply' | 'optimize-more'

interface OptimizeButtonProps {
	onOptimize: () => Promise<boolean | void>
	onStackOptimize?: () => Promise<boolean | void>
	isPending: boolean
	hasOptimized?: boolean
	mode?: OptimizeButtonMode
	label?: string
	buttonClassName?: string
	isPreparing?: boolean
	disabled?: boolean
}

const OPTIMIZER_PREPARING_TOOLTIP =
	'Preparing optimizer. Once ready, you can apply optimizations to improve performance and file size. Every preset re-processes from your original uploaded file — switching presets never chains on top of a previous pass.'

export const OptimizeButton: FC<OptimizeButtonProps> = ({
	hasOptimized,
	mode,
	label,
	buttonClassName,
	isPending,
	isPreparing = false,
	disabled,
	onOptimize,
	onStackOptimize
}) => {
	const resolvedMode = mode ?? (hasOptimized ? 'optimize-more' : 'apply')
	const resolvedVariant =
		resolvedMode === 'optimize-more' ? 'secondary' : 'default'
	const buttonLabel =
		label ??
		(resolvedMode === 'optimize-more'
			? 'Re-apply Preset'
			: 'Apply Optimizations')

	const isDisabled = isPending || disabled

	if (resolvedMode === 'optimize-more' && onStackOptimize) {
		const splitButton = (
			<div className={`flex grow ${buttonClassName ?? ''}`.trim()}>
				<Button
					type="button"
					variant={resolvedVariant}
					className="grow rounded-r-none"
					onClick={onOptimize}
					disabled={isDisabled}
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
								{buttonLabel}
							</motion.div>
						)}
					</AnimatePresence>
				</Button>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant={resolvedVariant}
							className="rounded-l-none border-l px-2"
							disabled={isDisabled}
						>
							<ChevronDownIcon className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" sideOffset={6} className="z-100">
						<DropdownMenuItem onClick={onStackOptimize}>
							<SparklesIcon className="h-4 w-4" />
							Optimize Further
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		)

		return (
			<div className="flex grow">
				{isPreparing ? (
					<Tooltip>
						<TooltipTrigger asChild>{splitButton}</TooltipTrigger>
						<TooltipContent className="max-w-80" sideOffset={6}>
							{OPTIMIZER_PREPARING_TOOLTIP}
						</TooltipContent>
					</Tooltip>
				) : (
					splitButton
				)}
			</div>
		)
	}

	const button = (
		<Button
			type="button"
			variant={resolvedVariant}
			className={`grow ${buttonClassName ?? ''}`.trim()}
			onClick={onOptimize}
			disabled={isDisabled}
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
	)

	return (
		<div className="flex">
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
