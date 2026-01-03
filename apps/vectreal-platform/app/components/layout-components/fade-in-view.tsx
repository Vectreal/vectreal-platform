import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

interface FadeInViewProps {
	children: React.ReactNode
	className?: string
	enabled?: boolean
	delay?: number
}

const FadeInView = ({
	children,
	className,
	enabled = true,
	delay = 0
}: FadeInViewProps) => {
	const ref = useRef<HTMLDivElement>(null)
	const isInView = useInView(ref, {
		once: true,
		margin: '-75px 0px',
		amount: 0.2
	})

	return enabled ? (
		<motion.div
			ref={ref}
			initial={{ opacity: 0, y: 40 }}
			animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
			transition={{
				duration: 0.8,
				delay,
				ease: [0.25, 0.1, 0.25, 1]
			}}
			className={className}
		>
			{children}
		</motion.div>
	) : (
		<div ref={ref} className={className}>
			{children}
		</div>
	)
}

export default FadeInView
