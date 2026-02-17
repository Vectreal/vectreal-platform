import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { Slider } from '@shared/components/ui/slider'
import { cn } from '@shared/utils'
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type KeyboardEvent
} from 'react'

import {
	mapSliderToValue,
	mapValueToSlider,
	ValueMapping
} from '../../../lib/utils/value-mapping'
import { InfoTooltip } from '../../info-tooltip'

/**
 * Props for RangeSettingSlider component
 */
interface RangeSettingSliderProps {
	id: string
	enabled?: boolean
	label: string
	tooltip?: string
	rangeProps: {
		minValue: number
		maxValue: number
		min: number
		max: number
		step: number
		onChange: (minValue: number, maxValue: number) => void
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
	/** Labels for the two range ends */
	rangeLabels?: {
		min: string
		max: string
	}
}

/**
 * RangeSettingSlider component for controlling ranges like near-far, min-max, etc.
 * Features:
 * - Dual-handle slider for range selection
 * - Interactive inputs for direct value entry
 * - Support for logarithmic/exponential value mappings
 * - Prevents invalid ranges (min > max)
 */
const RangeSettingSlider = ({
	id,
	enabled = true,
	label,
	tooltip,
	rangeProps: { minValue, maxValue, min, max, step, onChange },
	labelProps: { low, high },
	formatValue = (val) => val.toFixed(2),
	valueMapping,
	allowDirectInput = true,
	rangeLabels = { min: 'Min', max: 'Max' }
}: RangeSettingSliderProps) => {
	const [isEditingMin, setIsEditingMin] = useState(false)
	const [isEditingMax, setIsEditingMax] = useState(false)
	const [inputMinValue, setInputMinValue] = useState(formatValue(minValue))
	const [inputMaxValue, setInputMaxValue] = useState(formatValue(maxValue))
	const inputMinRef = useRef<HTMLInputElement>(null)
	const inputMaxRef = useRef<HTMLInputElement>(null)

	// Update input values when external values change and not editing
	useEffect(() => {
		if (!isEditingMin) {
			setInputMinValue(formatValue(minValue))
		}
	}, [minValue, formatValue, isEditingMin])

	useEffect(() => {
		if (!isEditingMax) {
			setInputMaxValue(formatValue(maxValue))
		}
	}, [maxValue, formatValue, isEditingMax])

	// Convert actual values to slider positions (0-1 normalized)
	const sliderMinValue = valueMapping
		? mapValueToSlider(minValue, min, max, valueMapping)
		: (minValue - min) / (max - min)
	const sliderMaxValue = valueMapping
		? mapValueToSlider(maxValue, min, max, valueMapping)
		: (maxValue - min) / (max - min)

	const handleSliderChange = useCallback(
		(values: number[]) => {
			const [normalizedMin, normalizedMax] = values

			const actualMin = valueMapping
				? mapSliderToValue(normalizedMin, min, max, valueMapping)
				: min + normalizedMin * (max - min)
			const actualMax = valueMapping
				? mapSliderToValue(normalizedMax, min, max, valueMapping)
				: min + normalizedMax * (max - min)

			// Round to step precision
			const steppedMin = Math.round(actualMin / step) * step
			const steppedMax = Math.round(actualMax / step) * step

			onChange(
				Math.max(min, Math.min(max, steppedMin)),
				Math.max(min, Math.min(max, steppedMax))
			)
		},
		[min, max, step, onChange, valueMapping]
	)

	// Min value input handlers
	const handleMinInputFocus = useCallback(() => {
		setIsEditingMin(true)
		setTimeout(() => inputMinRef.current?.select(), 0)
	}, [])

	const handleMinInputBlur = useCallback(() => {
		setIsEditingMin(false)
		const numValue = parseFloat(inputMinValue)
		if (!isNaN(numValue)) {
			const clampedValue = Math.max(min, Math.min(maxValue, numValue))
			const steppedValue = Math.round(clampedValue / step) * step
			onChange(steppedValue, maxValue)
			setInputMinValue(formatValue(steppedValue))
		} else {
			setInputMinValue(formatValue(minValue))
		}
	}, [inputMinValue, min, maxValue, step, minValue, onChange, formatValue])

	// Max value input handlers
	const handleMaxInputFocus = useCallback(() => {
		setIsEditingMax(true)
		setTimeout(() => inputMaxRef.current?.select(), 0)
	}, [])

	const handleMaxInputBlur = useCallback(() => {
		setIsEditingMax(false)
		const numValue = parseFloat(inputMaxValue)
		if (!isNaN(numValue)) {
			const clampedValue = Math.max(minValue, Math.min(max, numValue))
			const steppedValue = Math.round(clampedValue / step) * step
			onChange(minValue, steppedValue)
			setInputMaxValue(formatValue(steppedValue))
		} else {
			setInputMaxValue(formatValue(maxValue))
		}
	}, [inputMaxValue, minValue, max, step, maxValue, onChange, formatValue])

	const handleKeyDown = useCallback(
		(
			e: KeyboardEvent<HTMLInputElement>,
			currentValue: number,
			isMin: boolean
		) => {
			if (e.key === 'Enter') {
				;(isMin ? inputMinRef : inputMaxRef).current?.blur()
			} else if (e.key === 'Escape') {
				if (isMin) {
					setInputMinValue(formatValue(currentValue))
					inputMinRef.current?.blur()
				} else {
					setInputMaxValue(formatValue(currentValue))
					inputMaxRef.current?.blur()
				}
			}
		},
		[formatValue]
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
			</div>

			{/* Range input fields */}
			<div className="grid grid-cols-2 gap-2">
				<div className="space-y-1">
					<Label
						htmlFor={`${id}-min`}
						className="text-muted-foreground text-xs"
					>
						{rangeLabels.min}
					</Label>
					{allowDirectInput ? (
						<Input
							ref={inputMinRef}
							id={`${id}-min`}
							type="text"
							inputMode="decimal"
							value={inputMinValue}
							onChange={(e) => setInputMinValue(e.target.value)}
							onFocus={handleMinInputFocus}
							onBlur={handleMinInputBlur}
							onKeyDown={(e) => handleKeyDown(e, minValue, true)}
							className="text-accent h-8 text-sm font-medium"
							aria-label={`${label} ${rangeLabels.min} value`}
						/>
					) : (
						<div className="text-accent flex h-8 items-center rounded-md border px-3 text-sm font-medium">
							{formatValue(minValue)}
						</div>
					)}
				</div>
				<div className="space-y-1">
					<Label
						htmlFor={`${id}-max`}
						className="text-muted-foreground text-xs"
					>
						{rangeLabels.max}
					</Label>
					{allowDirectInput ? (
						<Input
							ref={inputMaxRef}
							id={`${id}-max`}
							type="text"
							inputMode="decimal"
							value={inputMaxValue}
							onChange={(e) => setInputMaxValue(e.target.value)}
							onFocus={handleMaxInputFocus}
							onBlur={handleMaxInputBlur}
							onKeyDown={(e) => handleKeyDown(e, maxValue, false)}
							className="text-accent h-8 text-sm font-medium"
							aria-label={`${label} ${rangeLabels.max} value`}
						/>
					) : (
						<div className="text-accent flex h-8 items-center rounded-md border px-3 text-sm font-medium">
							{formatValue(maxValue)}
						</div>
					)}
				</div>
			</div>

			<Slider
				id={id}
				min={0}
				max={1}
				step={0.001}
				value={[sliderMinValue, sliderMaxValue]}
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

export default RangeSettingSlider
