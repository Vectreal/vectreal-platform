// app/components/landing/step-flow.tsx
import { fadeUp, staggerContainer } from '@shared/components/motion'
import { cn } from '@shared/utils'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useRef } from 'react'

interface Step {
	number: string
	title: string
	body: string
}

interface StepFlowProps {
	steps: Step[]
	className?: string
}

export function StepFlow({ steps, className }: StepFlowProps) {
	const ref = useRef<HTMLDivElement>(null)
	const isInView = useInView(ref, { once: true, amount: 0.3 })
	const prefersReducedMotion = useReducedMotion()

	return (
		<div ref={ref} className={cn('relative', className)}>
			{/* Connector rail (desktop) — draws left to right, aligned to card centers */}
			<div
				className="relative mb-8 hidden h-2.5 lg:block"
				aria-hidden="true"
			>
				{/* Track + drawing fill span center-to-center of the 4 columns */}
				<div
					className="bg-surface-border absolute top-1/2 h-px -translate-y-1/2"
					style={{ left: '12.5%', right: '12.5%' }}
				/>
				<motion.div
					className="bg-accent absolute top-1/2 h-px origin-left -translate-y-1/2"
					style={{ left: '12.5%', right: '12.5%' }}
					initial={prefersReducedMotion ? undefined : { scaleX: 0 }}
					animate={
						prefersReducedMotion
							? undefined
							: isInView
								? { scaleX: 1 }
								: { scaleX: 0 }
					}
					transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
				/>
				{/* Nodes centered within each column */}
				<div className="absolute inset-0 grid grid-cols-4 items-center">
					{steps.map((step, i) => (
						<div key={step.number} className="flex justify-center">
							<motion.div
								className="bg-accent size-2.5 rounded-full ring-4 ring-[var(--background)]"
								initial={
									prefersReducedMotion ? undefined : { scale: 0, opacity: 0 }
								}
								animate={
									prefersReducedMotion
										? undefined
										: isInView
											? { scale: 1, opacity: 1 }
											: { scale: 0, opacity: 0 }
								}
								transition={{
									duration: 0.4,
									delay: 0.2 + i * (0.9 / steps.length),
									ease: [0.16, 1, 0.3, 1]
								}}
							/>
						</div>
					))}
				</div>
			</div>

			<motion.ol
				variants={prefersReducedMotion ? undefined : staggerContainer}
				initial={prefersReducedMotion ? undefined : 'hidden'}
				animate={
					prefersReducedMotion ? undefined : isInView ? 'visible' : 'hidden'
				}
				className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
			>
				{steps.map((step) => (
					<motion.li
						key={step.number}
						variants={prefersReducedMotion ? undefined : fadeUp}
						className="bg-surface-1 border-surface-border hover:border-accent/30 flex h-full flex-col gap-3 rounded-2xl border p-6 transition-colors"
					>
						<span
							className="font-medium leading-none"
							style={{
								fontSize: 'clamp(2.25rem, 4vw, 3rem)',
								letterSpacing: '-0.03em'
							}}
						>
							<span className="text-foreground/20">
								{step.number.slice(0, 1)}
							</span>
							<span className="text-accent">{step.number.slice(1)}</span>
						</span>
						<p className="text-foreground text-lg font-medium">{step.title}</p>
						<p className="text-muted-foreground text-sm leading-relaxed">
							{step.body}
						</p>
					</motion.li>
				))}
			</motion.ol>
		</div>
	)
}
