'use client'

import { cn } from '@shared/utils'
import { motion, useReducedMotion } from 'framer-motion'

/** `--duration-fast` and `--ease-out`, which Framer cannot read as tokens. */
const SLIDE = { duration: 0.15, ease: [0.16, 1, 0.3, 1] as const }

interface ActiveIndicatorProps {
	/**
	 * Shared by every option of one control, and unique to that control, so the
	 * fill moves from the option that was selected to the one that is.
	 */
	layoutId: string
	className?: string
}

/**
 * The `--foreground` fill behind the selected option of a one-of-many control,
 * which slides to the newly selected option instead of reappearing there.
 *
 * Render it inside the selected option only. The option has to be `relative`
 * and `isolate`: the fill sits at `-z-10` so it paints over the option's own
 * background and under its label, which inverts to `text-background` over it.
 *
 * The slide says where the selection came from, which a fill that blinks out
 * and in elsewhere does not, so it stays under `motion.md`'s rule that motion
 * carries information. It is the fast token with no spring, because these are
 * controls used constantly, and it is instant under reduced motion.
 */
function ActiveIndicator({ layoutId, className }: ActiveIndicatorProps) {
	const prefersReducedMotion = useReducedMotion()
	return (
		<motion.span
			aria-hidden
			layoutId={layoutId}
			transition={prefersReducedMotion ? { duration: 0 } : SLIDE}
			className={cn(
				'bg-foreground pointer-events-none absolute inset-0 -z-10 rounded-[inherit]',
				className
			)}
		/>
	)
}

export { ActiveIndicator }
