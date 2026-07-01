import type { Transition, Variants } from 'framer-motion'

export const fadeUp: Variants = {
	hidden: { opacity: 0, y: 24 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] }
	}
}

export const fadeIn: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
	}
}

export const scaleIn: Variants = {
	hidden: { opacity: 0, scale: 0.95 },
	visible: {
		opacity: 1,
		scale: 1,
		transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
	}
}

export const slideReveal: Variants = {
	hidden: { clipPath: 'inset(0 100% 0 0)' },
	visible: {
		clipPath: 'inset(0 0% 0 0)',
		transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
	}
}

export const staggerContainer: Variants = {
	hidden: {},
	visible: {
		transition: {
			staggerChildren: 0.08,
			delayChildren: 0.05
		}
	}
}

export const springConfig: Transition = {
	type: 'spring',
	stiffness: 400,
	damping: 30,
	mass: 0.8
}

export const cinematicConfig: Transition = {
	duration: 0.7,
	ease: [0.16, 1, 0.3, 1]
}
