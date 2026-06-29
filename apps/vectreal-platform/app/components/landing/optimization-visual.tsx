// app/components/landing/optimization-visual.tsx
import { cn } from '@shared/utils'
import {
	animate,
	motion,
	useInView,
	useMotionValue,
	useReducedMotion,
	useTransform
} from 'framer-motion'
import { ArrowDown, TrendingDown } from 'lucide-react'
import { useEffect, useRef } from 'react'

const RAW_MB = 124
const OPT_MB = 3.2
const REDUCTION = Math.round((1 - OPT_MB / RAW_MB) * 100) // 97
const OPT_WIDTH_PCT = (OPT_MB / RAW_MB) * 100 // ~2.6

export function OptimizationVisual({ className }: { className?: string }) {
	const ref = useRef<HTMLDivElement>(null)
	const isInView = useInView(ref, { once: true, amount: 0.4 })
	const prefersReducedMotion = useReducedMotion()

	// Optimized bar width (% of track) and the counting numbers
	const optWidth = useMotionValue(prefersReducedMotion ? OPT_WIDTH_PCT : 100)
	const optMb = useMotionValue(prefersReducedMotion ? OPT_MB : RAW_MB)
	const reduction = useMotionValue(prefersReducedMotion ? REDUCTION : 0)

	const optWidthStr = useTransform(optWidth, (w) => `${Math.max(w, 2.5)}%`)
	const optMbStr = useTransform(optMb, (v) => `${v.toFixed(1)} MB`)
	const reductionStr = useTransform(reduction, (v) => Math.round(v))

	useEffect(() => {
		if (!isInView || prefersReducedMotion) return
		const ease = [0.16, 1, 0.3, 1] as const
		const a = animate(optWidth, OPT_WIDTH_PCT, { duration: 1.6, ease, delay: 0.2 })
		const b = animate(optMb, OPT_MB, { duration: 1.6, ease, delay: 0.2 })
		const c = animate(reduction, REDUCTION, { duration: 1.6, ease, delay: 0.4 })
		return () => {
			a.stop()
			b.stop()
			c.stop()
		}
	}, [isInView, optWidth, optMb, reduction, prefersReducedMotion])

	return (
		<div
			ref={ref}
			className={cn(
				'bg-surface-1 border-surface-border relative overflow-hidden rounded-3xl border p-8 md:p-12',
				className
			)}
		>
			{/* ambient glow */}
			<div
				className="pointer-events-none absolute -top-1/3 right-0 h-80 w-80 rounded-full blur-[100px]"
				style={{
					background:
						'radial-gradient(circle, var(--surface-glow) 0%, transparent 70%)'
				}}
				aria-hidden="true"
			/>

			<div className="relative grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
				{/* Bars */}
				<div className="flex flex-col gap-8">
					{/* Raw */}
					<div className="flex flex-col gap-2">
						<div className="flex items-baseline justify-between">
							<span className="text-muted-foreground text-sm">
								Raw upload
							</span>
							<span className="text-muted-foreground font-medium tabular-nums">
								{RAW_MB} MB
							</span>
						</div>
						<div className="bg-surface-0 border-surface-border h-4 w-full overflow-hidden rounded-full border">
							<div className="bg-muted-foreground/40 h-full w-full rounded-full" />
						</div>
					</div>

					{/* Optimized */}
					<div className="flex flex-col gap-2">
						<div className="flex items-baseline justify-between">
							<span className="text-foreground text-sm font-medium">
								Vectreal optimized
							</span>
							<motion.span className="text-accent font-medium tabular-nums">
								{optMbStr}
							</motion.span>
						</div>
						<div className="bg-surface-0 border-surface-border h-4 w-full overflow-hidden rounded-full border">
							<motion.div
								className="bg-accent h-full rounded-full"
								style={{ width: optWidthStr }}
							/>
						</div>
					</div>
				</div>

				{/* Reduction badge */}
				<div className="flex flex-col items-start gap-3 lg:items-center lg:text-center">
					<div className="border-accent/20 bg-accent/5 inline-flex items-center gap-2 rounded-full border px-3 py-1">
						<TrendingDown className="text-accent size-3.5" aria-hidden="true" />
						<span className="text-eyebrow text-accent/80">Smaller payload</span>
					</div>
					<div className="text-stat text-foreground flex items-center">
						<ArrowDown
							className="text-accent mr-1 size-8 md:size-10"
							aria-hidden="true"
						/>
						<motion.span>{reductionStr}</motion.span>
						<span className="text-accent">%</span>
					</div>
					<p className="text-muted-foreground max-w-[28ch] text-sm leading-relaxed">
						Automatic mesh decimation, texture compression, and Draco encoding —
						with no visible quality loss.
					</p>
				</div>
			</div>
		</div>
	)
}
