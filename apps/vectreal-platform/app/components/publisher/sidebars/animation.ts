import { Variants } from 'framer-motion'

export const sidebarContentVariants: Variants = {
	initial: {
		opacity: 0,
		y: 10
	},
	animate: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.3,
			staggerChildren: 0.1
		}
	},
	exit: {
		opacity: 0,
		y: -10,
		transition: {
			duration: 0.2
		}
	}
}

export const itemVariants: Variants = {
	initial: { opacity: 0, y: 10 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -10 }
}
