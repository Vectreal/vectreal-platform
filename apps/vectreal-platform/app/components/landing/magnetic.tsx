// app/components/landing/magnetic.tsx
import {
	motion,
	useMotionValue,
	useReducedMotion,
	useSpring
} from 'framer-motion'

import type { PropsWithChildren } from 'react'

interface MagneticProps extends PropsWithChildren {
	className?: string
	/** Max pixel pull toward the cursor. */
	strength?: number
}

/**
 * Wraps children so they drift toward the cursor on hover and spring back on
 * leave. Disabled under prefers-reduced-motion. Keep on focal CTAs only.
 */
export function Magnetic({
	children,
	className,
	strength = 14
}: MagneticProps) {
	const prefersReducedMotion = useReducedMotion()

	const x = useMotionValue(0)
	const y = useMotionValue(0)
	const springX = useSpring(x, { stiffness: 350, damping: 22, mass: 0.6 })
	const springY = useSpring(y, { stiffness: 350, damping: 22, mass: 0.6 })

	function handleMove(e: React.MouseEvent<HTMLDivElement>) {
		if (prefersReducedMotion) return
		const rect = e.currentTarget.getBoundingClientRect()
		const relX = e.clientX - (rect.left + rect.width / 2)
		const relY = e.clientY - (rect.top + rect.height / 2)
		x.set((relX / (rect.width / 2)) * strength)
		y.set((relY / (rect.height / 2)) * strength)
	}

	function handleLeave() {
		x.set(0)
		y.set(0)
	}

	return (
		<motion.div
			className={className}
			style={prefersReducedMotion ? undefined : { x: springX, y: springY }}
			onMouseMove={handleMove}
			onMouseLeave={handleLeave}
		>
			{children}
		</motion.div>
	)
}
