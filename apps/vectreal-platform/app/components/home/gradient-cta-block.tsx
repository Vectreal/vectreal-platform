// app/components/landing/gradient-cta-block.tsx
import {
	fadeUp,
	staggerContainer,
	useInViewAnimation
} from '@shared/components/motion'
import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router'

interface CtaLink {
	label: string
	to: string
}

interface GradientCtaBlockProps {
	headline: string
	subtext: string
	primaryCta: CtaLink
	secondaryCta?: CtaLink
	className?: string
}

export function GradientCtaBlock({
	headline,
	subtext,
	primaryCta,
	secondaryCta,
	className
}: GradientCtaBlockProps) {
	const { ref, controls } = useInViewAnimation({ threshold: 0.2 })
	const prefersReducedMotion = useReducedMotion()

	return (
		<section
			className={cn('relative overflow-hidden py-24 md:py-28', className)}
			aria-label="Call to action"
		>
			{/* Radial glow bloom */}
			<div
				className={cn(
					'pointer-events-none absolute inset-0',
					!prefersReducedMotion && 'animate-glow-pulse'
				)}
				style={{
					background:
						'radial-gradient(ellipse 70% 60% at 50% 50%, var(--surface-glow), transparent 80%)'
				}}
				aria-hidden="true"
			/>

			<motion.div
				ref={ref}
				variants={prefersReducedMotion ? undefined : staggerContainer}
				initial={prefersReducedMotion ? undefined : 'hidden'}
				animate={controls}
				className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 text-center"
			>
				<motion.h2
					variants={prefersReducedMotion ? undefined : fadeUp}
					className="text-foreground font-medium text-balance"
					style={{
						fontSize: 'var(--text-headline)',
						letterSpacing: 'var(--tracking-headline)',
						lineHeight: 1.05
					}}
				>
					{headline}
				</motion.h2>

				<motion.p
					variants={prefersReducedMotion ? undefined : fadeUp}
					className="text-muted-foreground max-w-lg text-lg text-pretty"
				>
					{subtext}
				</motion.p>

				<motion.div
					variants={prefersReducedMotion ? undefined : fadeUp}
					className="flex flex-col gap-3 sm:flex-row"
				>
					<Button
						asChild
						size="lg"
						className="bg-accent hover:bg-accent/90 rounded-xl px-8 text-white"
					>
						<Link to={primaryCta.to}>{primaryCta.label}</Link>
					</Button>
					{secondaryCta && (
						<Button
							asChild
							size="lg"
							variant="outline"
							className="border-surface-border bg-surface-1/50 rounded-xl px-8 backdrop-blur-sm"
						>
							<Link to={secondaryCta.to}>{secondaryCta.label}</Link>
						</Button>
					)}
				</motion.div>
			</motion.div>
		</section>
	)
}
