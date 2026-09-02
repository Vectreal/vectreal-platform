import { cn } from '@shared/utils'

interface PresetButtonProps {
	label: string
	subLabel?: string
	isActive: boolean
	onClick: () => void
	className?: string
}

/**
 * Reusable preset selector button used across all compose inspector panels.
 * Provides consistent active/idle visual language with brand-orange accent ring.
 */
export const PresetButton = ({
	label,
	subLabel,
	isActive,
	onClick,
	className
}: PresetButtonProps) => (
	<button
		type="button"
		onClick={onClick}
		className={cn(
			'publisher-shell-focus rounded-xl px-3 py-2 text-xs font-semibold transition-all',
			isActive
				? 'border-orange/55 bg-shell-surface ring-orange/20 border shadow-sm ring-1'
				: 'bg-shell-surface-soft hover:bg-shell-surface',
			className
		)}
	>
		<span className="block">{label}</span>
		{subLabel && (
			<span className="text-muted-foreground block text-[10px] font-normal">
				{subLabel}
			</span>
		)}
	</button>
)
