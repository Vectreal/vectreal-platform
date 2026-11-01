import { cn } from '@shared/utils'

interface ThumbnailOption<V extends string> {
	value: V
	label: string
	src: string
}

interface ThumbnailGridProps<V extends string> {
	/** The group's accessible name. */
	label: string
	options: readonly ThumbnailOption<V>[]
	/** Undefined when none is current, as after an edit away from every setup. */
	value: V | undefined
	onSelect: (value: V) => void
}

/**
 * A choice between looks, each shown as a ball lit by it. Buttons rather than
 * a radio group: picking the current one again is a valid way to undo edits
 * made since, which a radio cannot express.
 *
 * The current one is marked the way every on state in the publisher is, its
 * label filling with the foreground, so it reads without color vision and
 * apart from the hover plate.
 */
export function ThumbnailGrid<V extends string>({
	label,
	options,
	value,
	onSelect
}: ThumbnailGridProps<V>) {
	return (
		<div
			role="group"
			aria-label={label}
			className="grid grid-cols-4 gap-x-0.5 gap-y-1"
		>
			{options.map((option) => {
				const selected = option.value === value
				return (
					<button
						key={option.value}
						type="button"
						aria-pressed={selected}
						onClick={() => onSelect(option.value)}
						className="shell-focus ds-ghost-interactive flex min-w-0 flex-col items-center gap-0.5 rounded-xl pb-1.5"
					>
						<img
							src={option.src}
							alt=""
							width={240}
							height={240}
							loading="lazy"
							decoding="async"
							draggable={false}
							className="aspect-[4/3] w-full object-cover"
						/>
						<span
							className={cn(
								'max-w-full truncate rounded-full px-1 py-0.5 text-[11px] leading-none tracking-tight',
								selected
									? 'bg-foreground text-background font-medium'
									: 'text-muted-foreground'
							)}
						>
							{option.label}
						</span>
					</button>
				)
			})}
		</div>
	)
}
