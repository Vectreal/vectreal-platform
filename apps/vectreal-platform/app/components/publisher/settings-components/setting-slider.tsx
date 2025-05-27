import { Label } from '@vctrl-ui/ui/label'

import { Slider } from '@vctrl-ui/ui/slider'

import { cn } from '@vctrl-ui/utils'

import { InfoTooltip } from '../../info-tooltip'

/**
 * Props for SettingSlider component
 */
interface SettingSliderProps {
	id: string
	enabled?: boolean
	label: string
	tooltip?: string
	sliderProps: {
		value: number
		min: number
		max: number
		step: number
		onChange: (value: number) => void
	}
	labelProps: {
		low: string
		high: string
	}
	formatValue?: (value: number) => string
}

/**
 * SettingSlider component for creating consistent slider sections
 */
const SettingSlider = ({
	id,
	enabled = true,
	label,
	tooltip,
	sliderProps: { value, min, max, step, onChange },
	labelProps: { low, high },
	formatValue = (val) => val.toFixed(2)
}: SettingSliderProps) => (
	<div
		className={cn('space-y-3', !enabled && 'pointer-events-none opacity-50')}
	>
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-2">
				<Label htmlFor={id}>{label}</Label>
				{tooltip && <InfoTooltip content={tooltip} />}
			</div>
			<span className="text-accent text-sm font-medium">
				{formatValue(value)}
			</span>
		</div>
		<Slider
			id={id}
			min={min}
			max={max}
			step={step}
			value={[value]}
			onValueChange={(values) => onChange(values[0])}
			className="py-1"
		/>
		<div className="text-muted-foreground flex justify-between text-xs">
			<span>{low}</span>
			<span>{high}</span>
		</div>
	</div>
)

export default SettingSlider
