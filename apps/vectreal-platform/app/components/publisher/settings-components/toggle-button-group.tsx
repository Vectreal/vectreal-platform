import { cn } from '@shared/utils'

import { PresetButton } from './preset-button'

const GRID_COLS = {
	2: 'grid-cols-2',
	3: 'grid-cols-3',
	4: 'grid-cols-4'
} as const

export interface ToggleButtonGroupOption<V> {
	value: V
	label: string
	subLabel?: string
}

interface ToggleButtonGroupProps<V> {
	options: ToggleButtonGroupOption<V>[]
	/** Exact-match active value. Ignored when `isActive` is provided. */
	value?: V
	/** Custom active predicate - use when active is determined by closest-match logic. */
	isActive?: (optionValue: V) => boolean
	onChange: (value: V) => void
	columns?: 2 | 3 | 4
	className?: string
}

export const ToggleButtonGroup = <V,>({
	options,
	value,
	isActive,
	onChange,
	columns = 3,
	className
}: ToggleButtonGroupProps<V>) => (
	<div className={cn('grid gap-1.5', GRID_COLS[columns], className)}>
		{options.map((option, index) => (
			<PresetButton
				key={index}
				label={option.label}
				subLabel={option.subLabel}
				isActive={isActive ? isActive(option.value) : option.value === value}
				onClick={() => onChange(option.value)}
			/>
		))}
	</div>
)
