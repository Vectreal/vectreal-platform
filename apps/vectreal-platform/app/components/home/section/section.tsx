import { cn } from '@shared/utils'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { type PropsWithChildren, useRef } from 'react'

interface SectionProps extends PropsWithChildren {
	className?: string
	/** Vertical rhythm. `default` for standard sections, `tight` to pull a
	 * related section closer to the one above it. */
	spacing?: 'default' | 'tight'
	/** Optional ambient bloom for depth. Position of the glow, or false. */
	glow?: 'left' | 'right' | false
	id?: string
	'aria-label'?: string
}

/**
 * Consistent landing-page section: fixed max width aligned to the hero,
 * uniform horizontal padding, deliberate vertical rhythm, and a single
 * fade-up reveal on scroll. Content always fills the column (no
 * shrink-to-content alignment drift).
 */
function Section({
	children,
	className,
	spacing = 'default',
	glow = false,
	id,
	'aria-label': ariaLabel
}: SectionProps) {
	const ref = useRef<HTMLDivElement>(null)
	const isInView = useInView(ref, {
		once: true,
		amount: 0.15,
		margin: '0px 0px -10% 0px'
	})
	const prefersReducedMotion = useReducedMotion()

	return (
		<section
			id={id}
			aria-label={ariaLabel}
			className={cn(
				'relative overflow-x-clip',
				spacing === 'tight' ? 'py-16 md:py-20' : 'py-24 md:py-36',
				className
			)}
		>
			{glow && (
				<div
					className={cn(
						'pointer-events-none absolute top-1/2 -z-0 h-[clamp(20rem,40vw,38rem)] w-[clamp(20rem,40vw,38rem)] -translate-y-1/2 rounded-full blur-[130px]',
						glow === 'left' ? '-left-40' : '-right-40'
					)}
					style={{
						background:
							'radial-gradient(circle, oklch(0.6 0.19 42 / 0.08) 0%, transparent 70%)'
					}}
					aria-hidden="true"
				/>
			)}
			<motion.div
				ref={ref}
				initial={prefersReducedMotion ? undefined : { opacity: 0, y: 28 }}
				animate={
					prefersReducedMotion
						? undefined
						: isInView
							? { opacity: 1, y: 0 }
							: { opacity: 0, y: 28 }
				}
				transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
				className="relative z-10 mx-auto w-full max-w-7xl px-6"
			>
				{children}
			</motion.div>
		</section>
	)
}

export default Section
