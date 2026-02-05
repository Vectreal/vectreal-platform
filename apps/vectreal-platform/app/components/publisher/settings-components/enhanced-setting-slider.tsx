import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { Slider } from '@shared/components/ui/slider'
import { cn } from '@shared/utils'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
	mapSliderToValue,
	mapValueToSlider,
	ValueMapping
} from '../../../lib/utils/value-mapping'
import { InfoTooltip } from '../../info-tooltip'

/**
 * Props for EnhancedSettingSlider component
 */
interface EnhancedSettingSliderProps {
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
	/** Optional value mapping for logarithmic or exponential scaling */
	valueMapping?: ValueMapping
	/** Allow direct input of values */
	allowDirectInput?: boolean
}

/**
 * Enhanced SettingSlider component with:
 * - Interactive value display for direct input
 * - Support for logarithmic/exponential value mappings
 * - Better precision control for wide ranges
 */
const EnhancedSettingSlider = ({
	id,
	enabled = true,
	label,
	tooltip,
	sliderProps: { value, min, max, step, onChange },
	labelProps: { low, high },
	formatValue = (val) => val.toFixed(2),
	valueMapping,
	allowDirectInput = true
}: EnhancedSettingSliderProps) => {
	const [isEditing, setIsEditing] = useState(false)
	const [inputValue, setInputValue] = useState(formatValue(value))
	const inputRef = useRef<HTMLInputElement>(null)

	// Update input value when external value changes and not editing
	useEffect(() => {
		if (!isEditing) {
			setInputValue(formatValue(value))
		}
	}, [value, formatValue, isEditing])

	// Convert actual value to slider position (0-1 normalized)
	const sliderValue = valueMapping
		? mapValueToSlider(value, min, max, valueMapping)
		: (value - min) / (max - min)

	const handleSliderChange = useCallback(
		(values: number[]) => {
			const normalizedValue = values[0]
			const actualValue = valueMapping
				? mapSliderToValue(normalizedValue, min, max, valueMapping)
				: min + normalizedValue * (max - min)

			// Round to step precision
			const steppedValue = Math.round(actualValue / step) * step
			onChange(Math.max(min, Math.min(max, steppedValue)))
		},
		[min, max, step, onChange, valueMapping]
	)

	const handleInputFocus = useCallback(() => {
		setIsEditing(true)
		// Select all text for easy replacement
		setTimeout(() => inputRef.current?.select(), 0)
	}, [])

	const handleInputBlur = useCallback(() => {
		setIsEditing(false)
		const numValue = parseFloat(inputValue)
		if (!isNaN(numValue)) {
			// Clamp and round to step
			const clampedValue = Math.max(min, Math.min(max, numValue))
			const steppedValue = Math.round(clampedValue / step) * step
			onChange(steppedValue)
			setInputValue(formatValue(steppedValue))
		} else {
			// Reset to current value if invalid
			setInputValue(formatValue(value))
		}
	}, [inputValue, min, max, step, value, onChange, formatValue])

	const handleInputKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Enter') {
				inputRef.current?.blur()
			} else if (e.key === 'Escape') {
				setInputValue(formatValue(value))
				inputRef.current?.blur()
			}
		},
		[value, formatValue]
	)

	return (
		<div
			className={cn('space-y-3', !enabled && 'pointer-events-none opacity-50')}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Label htmlFor={id}>{label}</Label>
					{tooltip && <InfoTooltip content={tooltip} />}
				</div>
				{allowDirectInput ? (
					<Input
						ref={inputRef}
						type="text"
						inputMode="decimal"
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onFocus={handleInputFocus}
						onBlur={handleInputBlur}
						onKeyDown={handleInputKeyDown}
						className="text-accent h-7 w-20 text-right text-sm font-medium"
						aria-label={`${label} value input`}
					/>
				) : (
					<span className="text-accent text-sm font-medium">
						{formatValue(value)}
					</span>
				)}
			</div>
			<Slider
				id={id}
				min={0}
				max={1}
				step={0.001}
				value={[sliderValue]}
				onValueChange={handleSliderChange}
				className="py-1"
				disabled={!enabled}
			/>
			<div className="text-muted-foreground flex justify-between text-xs">
				<span>{low}</span>
				<span>{high}</span>
			</div>
		</div>
	)
}

export default EnhancedSettingSlider
