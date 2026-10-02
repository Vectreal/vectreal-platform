'use client'

import * as SliderPrimitive from '@radix-ui/react-slider'
import {
	cn,
	mapSliderToValue,
	mapValueToSlider,
	type ValueMapping
} from '@shared/utils'
import * as React from 'react'

/** A named value the slider snaps to while dragging. */
export interface SliderPreset {
	value: number
	label: string
}

export interface SliderProps {
	/** Shown inside the bar and used as the accessible name. */
	label: string
	value: number
	onValueChange: (value: number) => void
	min: number
	max: number
	step: number
	/** Logarithmic or exponential scaling for wide ranges. Linear by default. */
	mapping?: ValueMapping
	/** Tick marks the value snaps to when a drag ends near one. */
	presets?: SliderPreset[]
	formatValue?: (value: number) => string
	/** Double-click or Enter turns the value into a text field. Default true. */
	editable?: boolean
	disabled?: boolean
	id?: string
	className?: string
}

/** How close, as a fraction of the bar, a drag has to come to a preset to snap. */
const SNAP_DISTANCE = 0.02
/**
 * Pointer resolution of the bar. Values are rounded to `step` afterwards, so
 * this only has to be finer than any step a caller passes.
 */
const POSITION_RESOLUTION = 0.001
/** Two pointer-downs closer than this belong to one double-click. */
const GESTURE_WINDOW_MS = 400

function decimalsOf(step: number): number {
	const [, fraction = ''] = String(step).split('.')
	return fraction.length
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value))
}

/**
 * A filled bar, in the manner of a Control Center slider.
 *
 * The track is the control's resting surface and the fill rises through it in
 * `--foreground`, so the state is carried by value rather than hue. The label
 * and value sit inside the bar and invert where the fill passes under them.
 *
 * That inversion is two layers rather than `mix-blend-mode: difference`. The
 * track is a translucent tint (`ds-field-interactive`), so a blend would mix
 * against whatever sits behind the control: a shell panel over the 3D canvas
 * in the publisher, an opaque dialog elsewhere. Clipping a second, inverted
 * copy of the label to the fill gives the same picture with contrast that does
 * not depend on the backdrop. The copy is `aria-hidden`.
 *
 * The bar runs over a normalized 0-1 position so `mapping` can stretch it, and
 * every value is rounded back to `step` in value space. Arrow keys therefore
 * step by `step`, not by a fraction of the bar, which is why they are handled
 * here rather than left to Radix.
 */
function Slider({
	label,
	value,
	onValueChange,
	min,
	max,
	step,
	mapping,
	presets,
	formatValue,
	editable = true,
	disabled = false,
	id,
	className
}: SliderProps) {
	const decimals = decimalsOf(step)
	const format = React.useCallback(
		(next: number) =>
			formatValue ? formatValue(next) : next.toFixed(decimals),
		[formatValue, decimals]
	)

	/** A value on the step grid, inside the range. */
	const snapToStep = React.useCallback(
		(raw: number) =>
			clamp(
				Number((Math.round(raw / step) * step).toFixed(decimals)),
				min,
				max
			),
		[step, decimals, min, max]
	)

	const toPosition = React.useCallback(
		(next: number) =>
			max === min ? 0 : mapValueToSlider(next, min, max, mapping),
		[min, max, mapping]
	)
	const toValue = React.useCallback(
		(position: number) =>
			snapToStep(mapSliderToValue(position, min, max, mapping)),
		[min, max, mapping, snapToStep]
	)

	const position = toPosition(value)
	const activePreset = presets?.find((preset) => preset.value === value)
	const valueText = activePreset
		? `${activePreset.label} · ${format(value)}`
		: format(value)

	// ---- Pointer -----------------------------------------------------------

	const handlePositionChange = React.useCallback(
		([nextPosition]: number[]) => {
			const snapped = presets?.find(
				(preset) =>
					Math.abs(toPosition(preset.value) - nextPosition) < SNAP_DISTANCE
			)
			onValueChange(snapped ? snapped.value : toValue(nextPosition))
		},
		[presets, toPosition, toValue, onValueChange]
	)

	// ---- Exact entry -------------------------------------------------------

	const [draft, setDraft] = React.useState<null | string>(null)
	const revertValueRef = React.useRef(value)
	const gestureRef = React.useRef({ at: 0, valueBefore: value })
	const thumbRef = React.useRef<HTMLSpanElement>(null)
	// Selects the draft once, when the field mounts, not on every keystroke.
	const selectOnMount = React.useCallback((input: HTMLInputElement | null) => {
		input?.select()
	}, [])

	/*
	  Whether an entry is open, as a ref. Ending one from the keyboard moves
	  focus back to the thumb, which blurs the field synchronously, inside the same handler and
	  before React has re-rendered. That blur runs the field's `onBlur` from the
	  previous render, so a check on the `draft` state would still see the
	  entry and commit it straight after Escape had reverted it.
	*/
	const isEditingRef = React.useRef(false)

	const startEditing = React.useCallback(
		(revertTo: number) => {
			isEditingRef.current = true
			revertValueRef.current = revertTo
			setDraft(format(value))
		},
		[format, value]
	)

	// ---- Keyboard ----------------------------------------------------------

	const handleThumbKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLSpanElement>) => {
			const stepsByKey: Record<string, number> = {
				ArrowRight: 1,
				ArrowUp: 1,
				ArrowLeft: -1,
				ArrowDown: -1,
				PageUp: 10,
				PageDown: -10
			}
			const steps = stepsByKey[event.key]
			if (steps !== undefined) {
				event.preventDefault()
				const multiplier = event.shiftKey ? 10 : 1
				onValueChange(snapToStep(value + steps * multiplier * step))
				return
			}
			if (event.key === 'Enter' && editable) {
				event.preventDefault()
				startEditing(value)
			}
		},
		[value, step, editable, onValueChange, snapToStep, startEditing]
	)

	const handlePointerDownCapture = React.useCallback(() => {
		const now = Date.now()
		if (now - gestureRef.current.at > GESTURE_WINDOW_MS) {
			gestureRef.current.valueBefore = value
		}
		gestureRef.current.at = now
	}, [value])

	const handleDoubleClick = React.useCallback(() => {
		// A double-click inside the open field selects a word; it is not a restart.
		if (editable && !disabled && draft === null) {
			startEditing(gestureRef.current.valueBefore)
		}
	}, [editable, disabled, draft, startEditing])

	const finishEditing = React.useCallback(
		(commit: boolean) => {
			if (!isEditingRef.current || draft === null) return
			isEditingRef.current = false
			const parsed = Number.parseFloat(draft)
			if (commit && Number.isFinite(parsed)) {
				onValueChange(snapToStep(parsed))
			} else if (!commit) {
				onValueChange(revertValueRef.current)
			}
			setDraft(null)
		},
		[draft, onValueChange, snapToStep]
	)

	const percent = `${position * 100}%`

	const labelRow = (inverted: boolean) => (
		<span
			aria-hidden={inverted || undefined}
			className={cn(
				'pointer-events-none absolute inset-0 flex items-center justify-between gap-3 px-3 text-sm font-medium',
				inverted ? 'text-background' : 'text-foreground'
			)}
			style={
				inverted
					? { clipPath: `inset(0 calc(100% - ${percent}) 0 0)` }
					: undefined
			}
		>
			<span className="truncate">{label}</span>
			{draft === null && (
				<span className="shrink-0 tabular-nums">{valueText}</span>
			)}
		</span>
	)

	return (
		<SliderPrimitive.Root
			id={id}
			data-slot="slider"
			min={0}
			max={1}
			step={POSITION_RESOLUTION}
			value={[position]}
			onValueChange={handlePositionChange}
			onPointerDownCapture={handlePointerDownCapture}
			onDoubleClick={handleDoubleClick}
			disabled={disabled}
			className={cn(
				'relative flex h-9 w-full touch-none items-center select-none',
				'has-[[role=slider]:focus-visible]:outline-ring has-[[role=slider]:focus-visible]:outline-2 has-[[role=slider]:focus-visible]:outline-offset-2',
				'rounded-xl data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
				className
			)}
		>
			<SliderPrimitive.Track
				data-slot="slider-track"
				className="ds-field-interactive relative h-full grow overflow-hidden rounded-xl"
			>
				<SliderPrimitive.Range
					data-slot="slider-range"
					className="bg-foreground absolute h-full"
				/>
				{presets?.map((preset) => (
					<span
						key={preset.value}
						aria-hidden
						className={cn(
							'pointer-events-none absolute bottom-1 h-1.5 w-px -translate-x-1/2',
							toPosition(preset.value) <= position
								? 'bg-background/60'
								: 'bg-foreground/30'
						)}
						style={{ left: `${toPosition(preset.value) * 100}%` }}
					/>
				))}
				{labelRow(false)}
				{labelRow(true)}
			</SliderPrimitive.Track>
			<SliderPrimitive.Thumb
				ref={thumbRef}
				data-slot="slider-thumb"
				aria-label={label}
				aria-valuetext={valueText}
				onKeyDown={handleThumbKeyDown}
				className="block h-4 w-0.5 rounded-full bg-transparent focus-visible:outline-none"
			/>
			{draft !== null && (
				<input
					ref={selectOnMount}
					type="text"
					inputMode="decimal"
					aria-label={`${label} value`}
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					// A blur already chose where focus goes, so it only commits.
					onBlur={() => finishEditing(true)}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault()
							finishEditing(true)
							thumbRef.current?.focus()
						} else if (event.key === 'Escape') {
							// Handled here so an enclosing panel does not treat it as "close".
							event.preventDefault()
							event.stopPropagation()
							finishEditing(false)
							thumbRef.current?.focus()
						}
					}}
					onPointerDown={(event) => event.stopPropagation()}
					className="bg-background text-foreground absolute top-1 right-1 bottom-1 w-24 rounded-lg px-2 text-right text-sm tabular-nums outline-none"
				/>
			)}
		</SliderPrimitive.Root>
	)
}

export { Slider }
