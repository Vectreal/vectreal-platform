// app/components/landing/stat-ring.tsx
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

interface StatRingProps {
	value: number
	suffix?: string
	label: string
	source?: string
	sourceUrl?: string
	className?: string
	/** Seconds to wait before this ring begins animating (for staggering). */
	delay?: number
}

const SIZE = 132
const STROKE = 6
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function StatRing({
	value,
	suffix = '%',
	label,
	source,
	sourceUrl,
	className,
	delay = 0
}: StatRingProps) {
	const ref = useRef<HTMLDivElement>(null)
	const isInView = useInView(ref, {
		once: true,
		amount: 0.8,
		margin: '0px 0px -12% 0px'
	})
	const prefersReducedMotion = useReducedMotion()

	const progress = useMotionValue(prefersReducedMotion ? value / 100 : 0)
	const count = useMotionValue(prefersReducedMotion ? value : 0)
	const rounded = useTransform(count, (v) => Math.round(v))
	const dashoffset = useTransform(
		progress,
		(p) => CIRCUMFERENCE * (1 - p)
	)

	useEffect(() => {
		if (!isInView || prefersReducedMotion) return
		// Slow, controlled fill — staggered via `delay` so the rings resolve
		// one after another.
		const ease = [0.22, 1, 0.36, 1] as const
		const controls = animate(count, value, { duration: 2.6, ease, delay })
		const controls2 = animate(progress, value / 100, {
			duration: 2.6,
			ease,
			delay
		})
		return () => {
			controls.stop()
			controls2.stop()
		}
	}, [isInView, value, count, progress, prefersReducedMotion, delay])

	return (
		<div
			ref={ref}
			className={cn(
				'bg-surface-1 border-surface-border group flex flex-col items-center gap-4 rounded-2xl border p-6 text-center transition-[transform,border-color] duration-300',
				'hover:border-accent/30 hover:-translate-y-1',
				className
			)}
		>
			<div
				className="relative"
				style={{ width: SIZE, height: SIZE }}
			>
				<svg
					width={SIZE}
					height={SIZE}
					viewBox={`0 0 ${SIZE} ${SIZE}`}
					className="-rotate-90"
					aria-hidden="true"
				>
					{/* Track */}
					<circle
						cx={SIZE / 2}
						cy={SIZE / 2}
						r={RADIUS}
						fill="none"
						stroke="var(--surface-border)"
						strokeWidth={STROKE}
					/>
					{/* Progress */}
					<motion.circle
						cx={SIZE / 2}
						cy={SIZE / 2}
						r={RADIUS}
						fill="none"
						stroke="var(--accent)"
						strokeWidth={STROKE}
						strokeLinecap="round"
						strokeDasharray={CIRCUMFERENCE}
						style={{ strokeDashoffset: dashoffset }}
					/>
				</svg>
				<div className="absolute inset-0 flex items-center justify-center">
					<span
						className="text-foreground font-medium"
						style={{ fontSize: '2.25rem', letterSpacing: '-0.03em' }}
					>
						<motion.span>{rounded}</motion.span>
						<span className="text-accent">{suffix}</span>
					</span>
				</div>
			</div>

			<p className="text-muted-foreground max-w-[24ch] text-sm leading-relaxed">
				{label}
			</p>

			{source && (
				<div className="text-muted-foreground/50 mt-auto flex items-center gap-2 text-xs">
					<span>{source}</span>
					{sourceUrl && (
						<>
							<span aria-hidden="true">·</span>
							<Link
								to={sourceUrl}
								target="_blank"
								rel="noreferrer"
								className="hover:text-foreground underline-offset-4 transition-colors hover:underline"
							>
								Source
							</Link>
						</>
					)}
				</div>
			)}
		</div>
	)
}
