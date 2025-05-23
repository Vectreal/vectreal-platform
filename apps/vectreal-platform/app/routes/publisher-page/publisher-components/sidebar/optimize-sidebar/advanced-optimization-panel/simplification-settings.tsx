// UI Components
import { Switch } from '@vctrl-ui/ui/switch'
import { cn } from '@vctrl-ui/utils'
import { useAtom } from 'jotai'

// Store
import { InfoTooltip, SettingSlider } from '../../../../../../components'
import { optimizationAtom } from '../../../../../../lib/stores/publisher-config-store'

/**
 * Type definitions for optimization state structure
 */
interface SimplificationSettings {
	enabled: boolean
	ratio: number
	error: number
}

/**
 * Custom hook for simplification settings management
 */
const useSimplificationSettings = () => {
	const [state, setOptimization] = useAtom(optimizationAtom)
	const { simplification } = state.plannedOptimizations

	const updateSettings = (updates: Partial<SimplificationSettings>) => {
		setOptimization((prev) => ({
			...prev,
			plannedOptimizations: {
				...prev.plannedOptimizations,
				simplification: { ...simplification, ...updates }
			}
		}))
	}

	return { settings: simplification, updateSettings }
}

/**
 * SimplificationSettings component for controlling mesh simplification parameters
 */
export function SimplificationSettings() {
	const { settings, updateSettings } = useSimplificationSettings()
	const { enabled, ratio, error } = settings

	// Calculate estimated polygon reduction based on ratio
	const estimatedPolygons = Math.round(100000 * ratio)

	// Format decimal values consistently
	const formatDecimal = (value: number) => value.toFixed(3)

	return (
		<>
			<div className="mb-4 flex items-center justify-between px-2">
				<div className="flex items-center gap-2">
					<p className="text-lg font-medium">Mesh Simplification</p>
					<InfoTooltip content="Reduces polygon count while preserving the overall shape. Higher values maintain more detail but result in larger file sizes." />
				</div>
				<Switch
					checked={enabled}
					onCheckedChange={(checked) => updateSettings({ enabled: checked })}
				/>
			</div>

			<div
				className={cn(
					'bg-muted/25 space-y-6 rounded-xl p-4 text-sm',
					!enabled && 'pointer-events-none opacity-50'
				)}
			>
				<SettingSlider
					id="ratio-slider"
					label="Ratio"
					sliderProps={{
						value: ratio,
						min: 0,
						max: 1,
						step: 0.01,
						onChange: (value) => updateSettings({ ratio: value })
					}}
					labelProps={{
						low: 'More optimized',
						high: 'Higher quality'
					}}
				/>

				<div className="bg-muted/50 rounded-md p-3 text-sm">
					<span className="text-muted-foreground">Estimated polygons: </span>
					<span className="text-accent font-medium">
						{estimatedPolygons.toLocaleString()}
					</span>
				</div>

				<SettingSlider
					id="error-slider"
					label="Error Threshold"
					tooltip="Controls how much the simplified mesh can deviate from the original. Higher values allow more deviation but produce smaller files."
					sliderProps={{
						value: error,
						min: 0.0005,
						max: 0.02,
						step: 0.001,
						onChange: (value) => updateSettings({ error: value })
					}}
					labelProps={{
						low: 'Higher accuracy',
						high: 'Lower accuracy'
					}}
					formatValue={formatDecimal}
				/>
			</div>
		</>
	)
}
