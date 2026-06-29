// app/components/landing/stat-counter.tsx
import { cn } from '@shared/utils'
import {
	animate,
	motion,
	useInView,
	useMotionValue,
	useReducedMotion,
	useTransform
} from 'framer-motion'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router'

interface StatCounterProps {
	value: number
	suffix?: string
	prefix?: string
	label: string
	source?: string
	sourceUrl?: string
	className?: string
}

export function StatCounter({
	value,
	suffix = '',
	prefix = '',
	label,
	source,
	sourceUrl,
	className
}: StatCounterProps) {
	const ref = useRef<HTMLDivElement>(null)
	const isInView = useInView(ref, { once: true, amount: 0.5 })
	const prefersReducedMotion = useReducedMotion()

	const count = useMotionValue(prefersReducedMotion ? value : 0)
	const rounded = useTransform(count, (v) => Math.round(v))

	useEffect(() => {
		if (isInView && !prefersReducedMotion) {
			animate(count, value, {
				duration: 1.4,
				ease: [0.16, 1, 0.3, 1]
			})
		}
	}, [isInView, value, count, prefersReducedMotion])

	return (
		<div
			ref={ref}
			className={cn(
				'flex flex-col gap-3 rounded-2xl border p-8',
				'bg-surface-1 border-surface-border',
				className
			)}
		>
			<div className="text-foreground font-black leading-none tracking-tight"
				style={{ fontSize: 'var(--text-display)' }}>
				{prefix}
				<motion.span>{rounded}</motion.span>
				<span className="text-accent font-light">{suffix}</span>
			</div>
			<p className="text-muted-foreground max-w-[22ch] text-base leading-snug">
				{label}
			</p>
			{source && (
				<div className="text-muted-foreground/60 mt-auto flex items-center justify-between text-xs">
					<span>{source}</span>
					{sourceUrl && (
						<Link
							to={sourceUrl}
							target="_blank"
							rel="noreferrer"
							className="hover:text-foreground transition-colors"
						>
							Read more →
						</Link>
					)}
				</div>
			)}
		</div>
	)
}
