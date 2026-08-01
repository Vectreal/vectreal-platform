import { Button } from '@shared/components'
import { cn } from '@shared/utils'
import { X } from 'lucide-react'

export interface PreviewExitBadgeProps {
	/** The mode this badge names. */
	label?: string
	/** Accessible name for the exit control; also its tooltip. */
	exitLabel: string
	onExit: () => void
	className?: string
}

/**
 * "You are previewing, and here is the way out."
 *
 * Shared by the publisher's in-canvas preview mode and the standalone `/preview`
 * route so leaving a preview looks and reads the same in both, the way
 * `CameraSwitcherPill` already does for switching cameras. Two very different
 * exits — one clears a jotai flag, the other navigates — behind one affordance.
 */
const PreviewExitBadge = ({
	label = 'Preview',
	exitLabel,
	onExit,
	className
}: PreviewExitBadgeProps) => (
	<div
		className={cn(
			'bg-muted/92 border-border/70 flex items-center gap-1 rounded-2xl border py-1 pr-1 pl-3 shadow-2xl backdrop-blur-2xl',
			className
		)}
	>
		<span className="text-xs font-medium">{label}</span>
		<Button
			variant="ghost"
			size="icon"
			onClick={onExit}
			aria-label={exitLabel}
			title={exitLabel}
			className="h-7 w-7 rounded-xl"
		>
			<X className="h-3.5 w-3.5" />
		</Button>
	</div>
)

export default PreviewExitBadge
