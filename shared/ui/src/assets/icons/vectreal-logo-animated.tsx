import { cn } from '@vctrl-ui/utils'
import { motion } from 'framer-motion'

interface Props {
	className?: string
	small?: boolean
	colored?: boolean
}

const parentVariants = {
	hidden: {
		transition: { ease: 'easeInOut' }
	},
	visible: {
		opacity: 1,
		transition: { ease: 'easeInOut', duration: 0.75, staggerChildren: 0.05 }
	}
}

const childVariants = {
	hidden: {
		opacity: 0,
		display: 'none'
	},
	visible: {
		transition: { ease: 'easeInOut' },
		opacity: 1,
		display: 'block'
	}
}

export const VectrealLogoAnimated = ({ small, colored, className }: Props) => {
	return (
		<motion.svg
			role="img"
			className={className}
			height="100%"
			viewBox="0 0 420 120"
			initial="hidden"
			variants={parentVariants}
			animate={!small ? 'visible' : 'hidden'}
		>
			<g id="Full_logos_dark_bg" data-name="Full logos dark bg">
				<path
					fill="currentColor"
					className={cn(
						'transition-colors duration-500',
						colored && 'text-accent'
					)}
					d="M100.18,82.41l-26.13.08a15.19,15.19,0,0,1,26.13-.08ZM87.14,105a15.16,15.16,0,0,0,11-4.68l10.8,10.42V97.53H74.05A15.14,15.14,0,0,0,87.14,105Zm9.91-93.25A40.56,40.56,0,0,0,68.41,0H0V60H18.41L31.69,95.7,46,60H63.39l-25.34,60H87.14a30,30,0,1,1,21.78-50.79v-29A39.81,39.81,0,0,0,97.05,11.75Z"
				/>
				<motion.path
					fill="currentColor"
					variants={childVariants}
					d="M161.83,98.12a14.32,14.32,0,0,1-1.78,2.25,15,15,0,1,1,2-18l11.71-9.68v0A30.33,30.33,0,0,0,118.8,90v0a30.33,30.33,0,0,0,55.47,16.63Z"
				/>
				<motion.path
					fill="currentColor"
					variants={childVariants}
					d="M195,75V91.27C195,105,212.89,105,212.89,105v14.93c-25.15,0-33.08-14.93-33.08-28.66V45.73L195,40.12V60l17.94.07V75Z"
				/>
				<motion.path
					fill="currentColor"
					variants={childVariants}
					d="M253.07,59.78l0,15a15.06,15.06,0,0,0-15.13,15v30H222.77v-30a29.89,29.89,0,0,1,15.14-26A30.34,30.34,0,0,1,253.07,59.78Z"
				/>
				<motion.path
					fill="currentColor"
					variants={childVariants}
					d="M282.77,59.78a30,30,0,1,0,21.79,50.8l-10.81-10.44a15.22,15.22,0,0,1-24.07-2.78h42.38a29.14,29.14,0,0,0,1-7.52v-.07A30.13,30.13,0,0,0,282.77,59.78ZM269.68,82.32a15.2,15.2,0,0,1,26.13-.09Z"
				/>
				<motion.path
					fill="currentColor"
					variants={childVariants}
					d="M359.83,59.78v4.08a30.33,30.33,0,0,0-45.4,25.91v.07a30.3,30.3,0,0,0,45.4,26v4H375V54.17Zm-4.15,40.43a15,15,0,1,1,4.15-10.31A14.82,14.82,0,0,1,355.68,100.21Z"
				/>
				<motion.polygon
					fill="currentColor"
					variants={childVariants}
					points="400 119.75 384.86 119.75 384.85 39.94 400 34.33 400 119.75"
				/>
			</g>
		</motion.svg>
	)
}
