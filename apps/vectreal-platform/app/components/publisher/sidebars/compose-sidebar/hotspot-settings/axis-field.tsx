import { Input } from '@shared/components/ui/input'
import { memo, useState } from 'react'

export const AXES = ['X', 'Y', 'Z'] as const

/**
 * One axis of the world-space position.
 *
 * The label is a prefix inside the well rather than a line above it: three
 * stacked label lines cost about 54px in a 304px column. The focus ring moves
 * to the well so the affordance still reads at the size the input ends up.
 *
 * The field keeps its own string while it is being typed in, and that is the
 * whole point of it. Committed state holds a number, and a controlled
 * `type="number"` input reports `""` for any entry that is not yet one - `""`
 * itself, a lone `-`, a trailing `.`. React re-runs its input restore after
 * every change event whether or not the handler set state, so a handler that
 * bails on `NaN` hands the old digits straight back on that keystroke. Clearing
 * the well was therefore impossible, and with it the only natural way to enter
 * a negative coordinate - in a scene centered on the origin, half the space.
 */
export const AxisField = memo(
	({
		axis,
		value,
		onChange
	}: {
		axis: (typeof AXES)[number]
		value: number
		onChange: (raw: string) => void
	}) => {
		const [draft, setDraft] = useState<string | null>(null)

		// Committed state wins whenever the field is not mid-edit, so a drag on the
		// canvas still moves the numbers under the author's cursor.
		const shown = draft ?? String(value)

		return (
			<div className="publisher-shell-nested focus-within:ring-ring flex items-center rounded-lg pl-2 focus-within:ring-2">
				<span
					aria-hidden
					className="text-muted-foreground w-3 shrink-0 text-xs font-medium"
				>
					{axis}
				</span>
				<Input
					type="number"
					step="0.1"
					aria-label={`${axis} position`}
					value={shown}
					onChange={(event) => {
						const raw = event.target.value
						setDraft(raw)
						onChange(raw)
					}}
					onBlur={() => setDraft(null)}
					className="h-8 border-0 bg-transparent px-2 font-mono text-xs shadow-none focus-visible:ring-0"
				/>
			</div>
		)
	}
)

AxisField.displayName = 'AxisField'
