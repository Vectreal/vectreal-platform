import { cn } from '@shared/utils'
import { motion } from 'framer-motion'
import { PropsWithChildren } from 'react'

interface FloatingPillWrapperProps extends PropsWithChildren {
	className?: string
	onClick?: () => void
}

const FloatingPillWrapper = ({
	className,
	...rest
}: FloatingPillWrapperProps) => {
	return (
		<motion.div
			layout="position"
			{...rest}
			className={cn(
				'publisher-shell-floating flex w-fit items-center justify-between p-2',
				className
			)}
		/>
	)
}

export default FloatingPillWrapper
