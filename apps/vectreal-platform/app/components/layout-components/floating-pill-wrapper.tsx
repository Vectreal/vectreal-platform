import { cn } from '@shared/utils'
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
		<div
			{...rest}
			className={cn(
				'bg-background/50 flex w-fit items-center justify-between rounded-2xl p-2 shadow-2xl backdrop-blur-2xl',
				className
			)}
		/>
	)
}

export default FloatingPillWrapper
