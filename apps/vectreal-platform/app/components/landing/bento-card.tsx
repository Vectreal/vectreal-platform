// app/components/landing/bento-card.tsx
import { cn } from '@shared/utils'
import {
	motion,
	useMotionValue,
	useReducedMotion,
	useSpring,
	useTransform
} from 'framer-motion'

import type { PropsWithChildren } from 'react'


interface BentoCardProps extends PropsWithChildren {
	className?: string
	tilt?: boolean
	glow?: boolean
	as?: 'div' | 'li' | 'article'
}

export function BentoCard({
	children,
	className,
	tilt = false,
	glow = false,
	as: Tag = 'div'
}: BentoCardProps) {
	const prefersReducedMotion = useReducedMotion()

	const mouseX = useMotionValue(0)
	const mouseY = useMotionValue(0)

	const springX = useSpring(mouseX, { stiffness: 400, damping: 30 })
	const springY = useSpring(mouseY, { stiffness: 400, damping: 30 })

	const rotateX = useTransform(springY, [-0.5, 0.5], [6, -6])
	const rotateY = useTransform(springX, [-0.5, 0.5], [-6, 6])

	function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
		if (!tilt || prefersReducedMotion) return
		const rect = e.currentTarget.getBoundingClientRect()
		mouseX.set((e.clientX - rect.left) / rect.width - 0.5)
		mouseY.set((e.clientY - rect.top) / rect.height - 0.5)
	}

	function handleMouseLeave() {
		mouseX.set(0)
		mouseY.set(0)
	}

	return (
		<Tag className={cn('group relative', className)}>
			<motion.div
				onMouseMove={tilt ? handleMouseMove : undefined}
				onMouseLeave={tilt ? handleMouseLeave : undefined}
				style={
					tilt && !prefersReducedMotion
						? { rotateX, rotateY, transformStyle: 'preserve-3d' }
						: undefined
				}
				className={cn(
					'relative h-full overflow-hidden rounded-2xl border p-5 transition-colors duration-300',
					'bg-surface-1 border-surface-border',
					glow && 'hover:border-accent/30',
					'flex flex-col gap-3.5'
				)}
			>
				{/* Subtle inner radial gradient tint */}
				<div
					className="pointer-events-none absolute inset-0 rounded-2xl opacity-40"
					style={{
						background:
							'radial-gradient(ellipse at 0% 0%, var(--surface-glow) 0%, transparent 60%)'
					}}
				/>
				{/* Glow bloom on hover */}
				{glow && (
					<div
						className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
						style={{
							boxShadow: '0 0 48px 0 var(--surface-glow)',
						}}
					/>
				)}
				<div className="relative z-10 flex h-full flex-col gap-4">{children}</div>
			</motion.div>
		</Tag>
	)
}
