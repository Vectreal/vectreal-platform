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
	className
}: InlineNoticeProps) {
	return (
		<div
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
