// app/components/landing/step-flow.tsx
import {
	fadeUp,
	staggerContainer,
	useInViewAnimation
} from '@shared/components/motion'
import { cn } from '@shared/utils'
import { motion, useReducedMotion } from 'framer-motion'

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
	const { ref, controls } = useInViewAnimation({ threshold: 0.15 })
	const prefersReducedMotion = useReducedMotion()

	return (
		<div ref={ref}>
			<motion.ol
				variants={prefersReducedMotion ? undefined : staggerContainer}
				initial={prefersReducedMotion ? undefined : 'hidden'}
				animate={controls}
				className={cn(
					'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4',
					className
				)}
			>
				{steps.map((step, i) => (
					<motion.li
						key={step.number}
						variants={prefersReducedMotion ? undefined : fadeUp}
						className="relative flex flex-col gap-4"
					>
						{/* Connector line (desktop only) */}
						{i < steps.length - 1 && (
							<div
								className="bg-surface-border absolute top-5 left-full z-0 hidden h-px w-6 lg:block"
								aria-hidden="true"
							/>
						)}

						<div
							className={cn(
								'rounded-2xl border p-6',
								'bg-surface-1 border-surface-border',
								'flex h-full flex-col gap-3'
							)}
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
							<p
								className="text-foreground font-medium"
								style={{ fontSize: '1.125rem' }}
							>
								{step.title}
							</p>
							<p className="text-muted-foreground text-sm leading-relaxed">
								{step.body}
							</p>
						</div>
					</motion.li>
				))}
			</motion.ol>
		</div>
	)
}
