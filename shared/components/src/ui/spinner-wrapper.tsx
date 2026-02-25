import { cn } from '@shared/utils'
import { PropsWithChildren } from 'react'

interface SpinnerWrapperProps extends PropsWithChildren {
	className?: string
}

export const SpinnerWrapper = ({
	children,
	className
}: SpinnerWrapperProps) => {
	return (
		<div
			className={cn(
				'flex h-full w-full flex-col items-center justify-center gap-4',
				className
			)}
		>
			{children}
		</div>
	)
}
