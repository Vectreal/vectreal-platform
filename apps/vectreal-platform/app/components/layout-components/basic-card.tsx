import { Card } from '@shared/components/ui/card'
import { cn } from '@shared/utils'
import { ComponentProps } from 'react'

interface BasicCardProps extends ComponentProps<'div'> {
	className?: string
	cardClassName?: string
	highlight?: boolean
	as?: 'div' | 'article' | 'section' | 'header'
}

const getHighlightClasses = (highlight: boolean | undefined) => {
	if (typeof highlight === 'boolean') {
		return highlight ? 'h-1 group-hover:w-16' : 'hidden'
	}
	return 'h-[1px] w-8'
}

const BasicCard = ({
	children,
	className,
	cardClassName,
	highlight,
	as: Component = 'div',
	...props
}: BasicCardProps) => {
	const highlightClasses = getHighlightClasses(highlight)

	return (
		<Component
			className={cn('group relative overflow-hidden rounded-3xl', className)}
			{...props}
		>
			<div
				className={cn(
					'bg-accent/60 absolute top-0 left-0 z-0 m-3 mt-0! h-2 animate-pulse rounded-full blur-xl transition-all md:m-6',
					highlightClasses
				)}
			/>
			<div
				className={cn(
					'bg-accent absolute top-0 left-0 z-10 m-3 mt-0! h-1 w-8 rounded-b-full transition-all md:m-6',
					highlightClasses
				)}
			/>
			<Card
				className={cn(
					'bg-surface-1 border-t-accent/25 border-l-accent/25 relative h-full rounded-3xl backdrop-blur-2xl',
					cardClassName
				)}
			>
				{children}
			</Card>
		</Component>
	)
}

export default BasicCard
