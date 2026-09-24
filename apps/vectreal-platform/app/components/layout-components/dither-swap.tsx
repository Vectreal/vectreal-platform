import { cn } from '@shared/utils'
import { useLayoutEffect, useRef, type ReactNode } from 'react'

import { dissolveIn } from '../../lib/dither/dither'

const SWAP_MS = 360

/**
 * Text that, when its value changes in place, dissolves in through the page's
 * dither rather than jumping: the format names in a converter's heading as the
 * reader switches between converters, and whatever else on that page changes
 * with them.
 *
 * Only on a change. The first render, the server's and StrictMode's second
 * mount included, shows the value as it is, because the previous value is
 * compared rather than a mount counted.
 */
export function DitherSwap({
	value,
	as: Tag = 'span',
	className,
	children
}: {
	value: string
	/** `div` where the content is a block, such as a stage's empty state. */
	as?: 'span' | 'div'
	className?: string
	children: ReactNode
}) {
	// Either tag, so the ref satisfies both.
	const ref = useRef<HTMLDivElement & HTMLSpanElement>(null)
	const shown = useRef(value)

	// Before paint, or the new value shows for a frame before it dissolves in.
	useLayoutEffect(() => {
		const el = ref.current
		if (!el || shown.current === value) return
		shown.current = value
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
		return dissolveIn(el, SWAP_MS)
	}, [value])

	return (
		<Tag ref={ref} className={cn(Tag === 'span' && 'inline-block', className)}>
			{children}
		</Tag>
	)
}
