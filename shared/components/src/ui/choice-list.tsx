'use client'

import { cn } from '@shared/utils'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import * as React from 'react'

export interface ChoiceListOption<Value extends string> {
	value: Value
	label: string
	icon?: React.ReactNode
	/** A short fact at the end of the row, such as "2K · 80%". */
	meta?: React.ReactNode
	/** Shown under the selected option only: what choosing it means. */
	detail?: React.ReactNode
}

interface ChoiceListProps<Value extends string> {
	/** The group's accessible name. */
	'aria-label': string
	options: readonly ChoiceListOption<Value>[]
	value: Value | undefined
	onValueChange: (value: Value) => void
	className?: string
}

/** `--duration-base` and `--ease-out`, which Framer cannot read as tokens. */
const EXPAND = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }

/**
 * One of several rich options, for choices that need a sentence each (an
 * export format, an optimization preset). Two or three short labels belong in
 * a `ToggleGroup`.
 *
 * Rows are pressable buttons in a group, not radios. A radio group selects as
 * the arrow keys move focus, which is right for a cheap choice and wrong here:
 * choosing a preset rewrites every optimization setting, so arrowing past it
 * would have thrown custom settings away. A row is chosen only when pressed.
 *
 * The selected row says "on" the way `Toggle` and `ToggleGroup` do: it fills
 * with `--foreground` and its content inverts. Its detail opens under it, so
 * only the choice in effect spends height on an explanation.
 */
function ChoiceList<Value extends string>({
	'aria-label': ariaLabel,
	options,
	value,
	onValueChange,
	className
}: ChoiceListProps<Value>) {
	const prefersReducedMotion = useReducedMotion()

	return (
		<div
			role="group"
			data-slot="choice-list"
			aria-label={ariaLabel}
			className={cn('flex flex-col gap-1.5', className)}
		>
			{options.map((option) => {
				const isSelected = option.value === value
				return (
					<button
						key={option.value}
						type="button"
						aria-pressed={isSelected}
						data-state={isSelected ? 'checked' : 'unchecked'}
						onClick={() => {
							if (!isSelected) onValueChange(option.value)
						}}
						data-slot="choice-list-item"
						className={cn(
							'ds-field-interactive w-full rounded-xl px-3 py-2.5 text-left',
							'data-[state=checked]:bg-foreground data-[state=checked]:text-background',
							'transition-colors duration-150 motion-reduce:transition-none',
							'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
							'disabled:cursor-not-allowed disabled:opacity-50'
						)}
					>
						<span className="flex items-center gap-3">
							{option.icon && (
								<span aria-hidden className="flex shrink-0 [&_svg]:size-4">
									{option.icon}
								</span>
							)}
							<span className="min-w-0 flex-1 truncate text-sm font-medium">
								{option.label}
							</span>
							{option.meta && (
								<span
									className={cn(
										'shrink-0 text-xs tabular-nums',
										isSelected ? 'text-background/70' : 'text-muted-foreground'
									)}
								>
									{option.meta}
								</span>
							)}
						</span>
						<AnimatePresence initial={false}>
							{isSelected && option.detail && (
								<motion.span
									key="detail"
									initial={{ height: 0, opacity: 0 }}
									animate={{ height: 'auto', opacity: 1 }}
									exit={{ height: 0, opacity: 0 }}
									transition={prefersReducedMotion ? { duration: 0 } : EXPAND}
									className={cn(
										'block overflow-hidden text-xs',
										'text-background/75',
										option.icon && 'pl-7'
									)}
								>
									<span className="block pt-2">{option.detail}</span>
								</motion.span>
							)}
						</AnimatePresence>
					</button>
				)
			})}
		</div>
	)
}

export { ChoiceList }
