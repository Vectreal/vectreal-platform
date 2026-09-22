import { cn } from '@shared/utils'

import type { ReactNode } from 'react'

const TONE_CLASSES = {
	warning: 'bg-warning-bg text-warning-foreground',
	error: 'bg-error-bg text-error-foreground',
	neutral: 'publisher-shell-nested text-muted-foreground'
} as const

interface InlineNoticeProps {
	tone?: keyof typeof TONE_CLASSES
	children: ReactNode
	className?: string
	/**
	 * Announce this notice when it appears.
	 *
	 * Opt-in, because most of these are rendered with the page and qualify a
	 * control that is already read out. A notice that appears in answer to
	 * something the reader just did is the other case, and silence there means a
	 * failed payment attempt is announced to nobody.
	 */
	role?: 'alert' | 'status'
}

/**
 * A short caveat sitting under the control it qualifies.
 *
 * Four of these existed across the publish and embed panels, and no two agreed:
 * two radii (`rounded-md` and `rounded-2xl`) and two foregrounds
 * (`text-warning-foreground` and `text-warning-muted-foreground`) for the same
 * kind of message. Each also drew a border, which the surface ladder replaces
 * with a value step.
 */
export function InlineNotice({
	tone = 'warning',
	children,
	className,
	role
}: InlineNoticeProps) {
	return (
		<div
			role={role}
			className={cn(
				'rounded-xl px-3 py-2 text-xs',
				TONE_CLASSES[tone],
				className
			)}
		>
			{children}
		</div>
	)
}
