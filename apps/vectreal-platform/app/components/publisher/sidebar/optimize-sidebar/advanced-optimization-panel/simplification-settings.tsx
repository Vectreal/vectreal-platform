// UI Components
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { Switch } from '@vctrl-ui/ui/switch'
import { cn } from '@vctrl-ui/utils'
import { useAtom } from 'jotai'

// Store
import { InfoTooltip, SettingSlider } from '../../../../../components'
import { optimizationAtom } from '../../../../../lib/stores/publisher-config-store'

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
	const { optimize } = useModelContext()
	const { report } = optimize
	const totalVertices =
		report?.meshes.properties.reduce(
			(total, mesh) => total + mesh.vertices,
			0
		) || 0

	const { enabled, ratio, error } = settings

	// Calculate estimated polygon reduction based on ratio
	const estimatedVertices = Math.round(totalVertices * (1 - ratio))

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
					label="Reduction Target"
					tooltip="Sets how much to reduce the original vertex count. A value of 0.5 aims to keep 50% of vertices."
					sliderProps={{
						value: ratio,
						min: 0,
						max: 1,
						step: 0.01,
						onChange: (value) => updateSettings({ ratio: value })
					}}
					labelProps={{
						low: 'Smaller file size',
						high: 'Better detail'
					}}
				/>

				<div className="bg-muted/50 rounded-md p-3 text-sm">
					<span className="text-muted-foreground">Estimated vertices: </span>
					<span className="text-accent font-medium">
						{estimatedVertices.toLocaleString()}
					</span>
				</div>

				<SettingSlider
					id="error-slider"
					label="Deviation Limit"
					tooltip="Determines maximum allowed deviation from original mesh. Higher values allow more simplification but less accuracy."
					sliderProps={{
						value: error,
						min: 0.0005,
						max: 0.02,
						step: 0.001,
						onChange: (value) => updateSettings({ error: value })
					}}
					labelProps={{
						low: 'More precise',
						high: 'More optimized'
					}}
					formatValue={formatDecimal}
				/>
			</div>
		</>
	)
}
