import { memo, ReactNode } from 'react'

/**
 * Wrapper for preset/toggle button groups with consistent typography and spacing.
 * Applies visual hierarchy where:
 * - Label is a subdued secondary text
 * - Controls are prominent primary elements
 * - Proper breathing room between sections
 */

interface PresetButtonGroupProps {
	label: string
	description?: string
	children: ReactNode
	className?: string
}

export const PresetButtonGroup = memo(
	({
		label,
		description,
		children,
		className = ''
	}: PresetButtonGroupProps) => (
		<div className={`space-y-2.5 ${className}`}>
			<div className="flex flex-col gap-0.5">
				<label className="text-muted-foreground text-xs font-medium">
					{label}
				</label>
				{description && (
					<p className="text-muted-foreground/70 text-xs">{description}</p>
				)}
			</div>
			<div>{children}</div>
		</div>
	)
)

PresetButtonGroup.displayName = 'PresetButtonGroup'
