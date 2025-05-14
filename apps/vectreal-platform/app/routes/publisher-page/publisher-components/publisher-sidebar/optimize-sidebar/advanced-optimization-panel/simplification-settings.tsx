import { Label } from '@vctrl-ui/ui/label'
import { Slider } from '@vctrl-ui/ui/slider'
import { Switch } from '@vctrl-ui/ui/switch'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '@vctrl-ui/ui/tooltip'
import { cn } from '@vctrl-ui/utils'
import { useAtom } from 'jotai'
import { Info } from 'lucide-react'

import { optimizationAtom } from '../../../../../../lib/stores/publisher-config-store'

export function SimplificationSettings() {
	const [{ plannedOptimizations }, setOptimization] = useAtom(optimizationAtom)

	const { enabled, ratio, error } = plannedOptimizations.simplification

	// Calculate estimated polygon reduction based on ratio
	const estimatedPolygons = Math.round(100000 * ratio)

	// Helper function to format decimals
	const formatDecimal = (value: number) => value.toFixed(3)

	return (
		<>
			<div className="mb-4 flex items-center justify-between px-2">
				<div className="flex items-center gap-2">
					<p className="text-lg font-medium">Mesh Simplification</p>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Info className="text-muted-foreground h-4 w-4 cursor-help" />
							</TooltipTrigger>
							<TooltipContent className="max-w-80">
								<p>
									Reduces polygon count while preserving the overall shape.
									Higher values maintain more detail but result in larger file
									sizes.
								</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
				<Switch
					checked={enabled}
					onCheckedChange={(checked) =>
						setOptimization((optimization) => ({
							...optimization,
							plannedOptimizations: {
								...optimization.plannedOptimizations,
								simplification: {
									...optimization.plannedOptimizations.simplification,
									enabled: checked
								}
							}
						}))
					}
				/>
			</div>

			<div
				className={cn(
					'bg-muted/25 space-y-6 rounded-xl p-4 text-sm',
					!enabled && 'pointer-events-none opacity-50'
				)}
			>
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<Label htmlFor="ratio-slider">Ratio</Label>
						<span className="text-accent text-sm font-medium">
							{ratio.toFixed(2)}
						</span>
					</div>
					<Slider
						id="ratio-slider"
						min={0}
						max={1}
						step={0.01}
						value={[ratio]}
						onValueChange={(value) =>
							setOptimization((optimization) => ({
								...optimization,
								plannedOptimizations: {
									...optimization.plannedOptimizations,
									simplification: {
										...optimization.plannedOptimizations.simplification,
										ratio: value[0]
									}
								}
							}))
						}
						className="py-1"
					/>
					<div className="text-muted-foreground flex justify-between text-xs">
						<span>More optimized</span>
						<span>Higher quality</span>
					</div>
					<div className="bg-muted/50 rounded-md p-3 text-sm">
						<span className="text-muted-foreground">Estimated polygons: </span>
						<span className="text-accent font-medium">
							{estimatedPolygons.toLocaleString()}
						</span>
					</div>
				</div>

				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Label htmlFor="error-slider">Error Threshold</Label>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Info className="text-muted-foreground h-4 w-4 cursor-help" />
									</TooltipTrigger>
									<TooltipContent className="max-w-80">
										<p>
											Controls how much the simplified mesh can deviate from the
											original. Higher values allow more deviation but produce
											smaller files.
										</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
						<span className="text-accent text-sm font-medium">
							{formatDecimal(error)}
						</span>
					</div>
					<Slider
						id="error-slider"
						min={0.0005}
						max={0.02}
						step={0.001}
						value={[error]}
						onValueChange={(value) =>
							setOptimization((optimization) => ({
								...optimization,
								plannedOptimizations: {
									...optimization.plannedOptimizations,
									simplification: {
										...optimization.plannedOptimizations.simplification,
										error: value[0]
									}
								}
							}))
						}
						className="py-1"
					/>
					<div className="text-muted-foreground flex justify-between text-xs">
						<span>Higher accuracy</span>
						<span>Lower accuracy</span>
					</div>
				</div>
			</div>
		</>
	)
}
