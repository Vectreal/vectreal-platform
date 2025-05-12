import { useModelContext } from '@vctrl/hooks/use-load-model'
import { cn } from '@vctrl-ui/utils'
import { Check, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { presetOptions } from './preset-data'
import PresetOption from './preset-option'

type OptimizationPreset = 'low' | 'medium' | 'high'

const BasicPanel = () => {
	const [optimizationPreset, setOptimizationPreset] =
		useState<OptimizationPreset>('medium')

	const {
		optimize: { optimizations, applyOptimization }
	} = useModelContext()

	function handleSelectOptimizationPreset(preset: OptimizationPreset) {
		setOptimizationPreset(preset)
	}

	const [isApplying, setIsApplying] = useState(false)
	const [isSuccess, setIsSuccess] = useState(false)
	const handleApplyOptimization = async () => {
		setIsApplying(true)
		setIsSuccess(false)
	}

	return (
		<div className="w-full">
			<div className="space-y-2">
				{presetOptions.map((preset) => (
					<PresetOption
						key={preset.id}
						preset={preset}
						isSelected={optimizationPreset === preset.id}
						onSelect={() => handleSelectOptimizationPreset(preset.id)}
					/>
				))}
			</div>

			<div className="border-border/50 mt-3 border-t pt-3">
				<button
					onClick={() => !isApplying && handleApplyOptimization()}
					disabled={isApplying || isSuccess}
					className={cn(
						'group relative w-full overflow-hidden rounded-md px-3 py-2 text-sm font-medium transition-all duration-300',
						'focus-visible:ring-ring focus:outline-none focus-visible:ring-2',
						isApplying
							? 'bg-muted text-muted-foreground cursor-not-allowed'
							: isSuccess
								? 'bg-success/10 text-success'
								: 'bg-primary text-primary-foreground hover:bg-primary/90'
					)}
				>
					<div className="relative flex items-center justify-center gap-2">
						{isApplying ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : isSuccess ? (
							<Check className="h-4 w-4" />
						) : null}

						<span>
							{isApplying
								? 'Applying...'
								: isSuccess
									? 'Applied'
									: 'Apply Optimization'}
						</span>
					</div>

					<div
						className={cn(
							'absolute inset-0 -translate-x-full transform transition-transform duration-500',
							'bg-gradient-to-r from-transparent via-white/20 to-transparent',
							'group-hover:translate-x-full',
							isApplying || isSuccess ? 'hidden' : ''
						)}
					/>
				</button>
			</div>
		</div>
	)
}

export default BasicPanel
