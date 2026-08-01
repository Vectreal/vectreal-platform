import { Progress } from '@shared/components/ui/progress'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

import { StepRow } from './step-row'
import { getOptimizationDefinition } from '../model'

import type { OptimizationStepsState } from '../use-optimization-steps'
import type { FC } from 'react'

/**
 * Steps that run long with no sub-progress to report. Draco encodes the whole
 * mesh in one WASM call, so an honest note beats a progress bar that would have
 * to be invented.
 */
const SLOW_STEP_HINTS: Record<string, string> = {
	[getOptimizationDefinition('draco').stepLabel]:
		'Encoding geometry — this can take a while.'
}

/** Below this the counter is noise rather than reassurance. */
const ELAPSED_VISIBLE_AFTER_SECONDS = 3

function useElapsedSeconds(step: string | null): number {
	const [seconds, setSeconds] = useState(0)

	useEffect(() => {
		setSeconds(0)
		if (!step) return

		const startedAt = Date.now()
		const interval = window.setInterval(
			() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)),
			1000
		)
		return () => window.clearInterval(interval)
	}, [step])

	return seconds
}

interface OptimizationProgressProps {
	steps: OptimizationStepsState
}

export const OptimizationProgress: FC<OptimizationProgressProps> = ({
	steps
}) => {
	const elapsedSeconds = useElapsedSeconds(steps.current)

	const progressPercent =
		steps.allSteps.length > 0
			? Math.round((steps.completed.length / steps.allSteps.length) * 100)
			: 0

	return (
		<motion.div
			key="processing"
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -8 }}
			transition={{ duration: 0.25 }}
			className="flex flex-col items-center px-6 py-10"
		>
			<div className="mb-6 flex flex-col items-center gap-3 text-center">
				<div className="relative flex h-16 w-16 items-center justify-center">
					<div
						className="bg-primary/10 absolute inset-0 animate-ping rounded-full"
						style={{ animationDuration: '2s' }}
					/>
					<div
						className="bg-primary/15 absolute inset-2 animate-ping rounded-full"
						style={{ animationDuration: '2s', animationDelay: '0.4s' }}
					/>
					<div className="border-primary/20 bg-primary/10 relative flex h-10 w-10 items-center justify-center rounded-full border">
						<Sparkles className="text-primary h-5 w-5" />
					</div>
				</div>
				<p className="text-sm font-medium">Processing your scene</p>
				<p className="text-muted-foreground max-w-xs text-xs">
					Do not close this panel while optimization is in progress.
				</p>
			</div>

			{steps.allSteps.length > 0 && (
				<div className="mb-6 w-full max-w-sm">
					<Progress value={progressPercent} className="h-1" />
					<p className="text-muted-foreground mt-1.5 text-right text-[11px]">
						{steps.completed.length} / {steps.allSteps.length} steps
					</p>
				</div>
			)}

			<div className="w-full max-w-sm space-y-1">
				{steps.allSteps.map((step) => {
					const isDone = steps.completed.includes(step)
					const isRunning = steps.current === step && !isDone

					return (
						<StepRow
							key={step}
							label={step}
							isDone={isDone}
							isRunning={isRunning}
							hint={SLOW_STEP_HINTS[step]}
							elapsedSeconds={
								elapsedSeconds >= ELAPSED_VISIBLE_AFTER_SECONDS
									? elapsedSeconds
									: undefined
							}
						/>
					)
				})}
			</div>
		</motion.div>
	)
}
