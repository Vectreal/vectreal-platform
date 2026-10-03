import { cn } from '@shared/utils'

import type { FC } from 'react'

const RADIUS = 9
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface ProgressRingProps {
	/**
	 * 0 to 100, or null while there is nothing to count yet: a dashed full
	 * ring, which turns where motion is allowed and still reads as working, not
	 * as a quarter done, where it is not.
	 */
	value: number | null
	className?: string
}

/** A circular progress indicator, drawn in the current text color. */
export const ProgressRing: FC<ProgressRingProps> = ({ value, className }) => (
	// eslint-disable-next-line no-restricted-syntax -- a graphic drawn from a measured value, not an icon
	<svg
		viewBox="0 0 24 24"
		aria-hidden
		className={cn(
			'size-5 shrink-0 -rotate-90',
			value === null && 'motion-safe:animate-spin',
			className
		)}
	>
		<circle
			cx="12"
			cy="12"
			r={RADIUS}
			fill="none"
			strokeWidth="2.5"
			className="stroke-current opacity-20"
		/>
		<circle
			cx="12"
			cy="12"
			r={RADIUS}
			fill="none"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeDasharray={value === null ? '4 3' : CIRCUMFERENCE}
			strokeDashoffset={value === null ? 0 : CIRCUMFERENCE * (1 - value / 100)}
			// `--ease-out` over `--duration-base`, as every other change in the panel.
			className="stroke-current transition-[stroke-dashoffset] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
		/>
	</svg>
)
