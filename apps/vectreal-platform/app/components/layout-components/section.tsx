import { cn } from '@vctrl-ui/utils'
import { motion } from 'framer-motion'
import { PropsWithChildren } from 'react'

interface SectionProps extends PropsWithChildren {
	className?: string
	border?: boolean
}

const Section = ({ children, className, border }: SectionProps) => {
	return (
		<motion.section
			className={cn(
				'relative my-48 flex w-full items-center justify-center gap-4 first:mt-0 last:mb-0',
				border && '-mb-48',
				className
			)}
		>
			<div
				className={cn(
					'flex h-full w-full max-w-7xl flex-col gap-4 p-4',
					border && 'border-b-muted/50 border-b pb-16'
				)}
			>
				{children}
			</div>
		</motion.section>
	)
}

export default Section
