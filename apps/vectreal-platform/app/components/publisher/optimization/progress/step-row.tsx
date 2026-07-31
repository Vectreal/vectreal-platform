import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { cn } from '@shared/utils'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle } from 'lucide-react'

import type { FC } from 'react'

interface StepRowProps {
	label: string
	isDone: boolean
	isRunning: boolean
	/** Shown only while running, for steps with no sub-progress to report. */
	hint?: string
	/** Seconds the step has been running, when it has been long enough to matter. */
	elapsedSeconds?: number
}

export const StepRow: FC<StepRowProps> = ({
	label,
	isDone,
	isRunning,
	hint,
	elapsedSeconds
}) => (
	<motion.div
		layout
		className={cn(
			'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-300',
			isRunning && 'bg-primary/5'
		)}
	>
		<div className="shrink-0">
			{isDone ? (
				<CheckCircle2 className="h-4 w-4 text-green-500" />
			) : isRunning ? (
				<LoadingSpinner className="h-4 w-4" />
			) : (
				<Circle className="text-muted-foreground/30 h-4 w-4" />
			)}
		</div>
		<div className="min-w-0 flex-1">
			<span
				className={cn(
					'transition-colors duration-300',
					isDone
						? 'text-muted-foreground line-through'
						: isRunning
							? 'text-foreground font-medium'
							: 'text-muted-foreground'
				)}
			>
				{label}
			</span>
			{isRunning && hint ? (
				<p className="text-muted-foreground text-[11px]">{hint}</p>
			) : null}
		</div>
		{isRunning && typeof elapsedSeconds === 'number' ? (
			<span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
				{elapsedSeconds}s
			</span>
		) : null}
	</motion.div>
)
