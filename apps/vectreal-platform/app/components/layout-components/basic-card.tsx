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
	return 'h-px w-8'
}

/**
 * A `Card` with the brand highlight bar across its top edge.
 *
 * The card body is deliberately left to `Card`, which already carries
 * `ds-raised`. This wrapper used to override it with `bg-muted/75`,
 * `rounded-3xl` and `border-t-accent/25 border-l-accent/25` - a raw surface, a
 * radius outside the scale, and a drawn bevel - which re-introduced all three
 * anti-patterns on every card across newsroom and docs. The bevel had also
 * quietly turned grey when `--accent` became the neutral hover token.
 */
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
			className={cn('group relative overflow-hidden rounded-2xl', className)}
			{...props}
		>
			<div
				className={cn(
					'bg-orange/60 absolute top-0 left-0 z-0 m-3 mt-0! h-2 animate-pulse rounded-full blur-xl transition-all md:m-6',
					highlightClasses
				)}
			/>
			<div
				className={cn(
					'bg-orange absolute top-0 left-0 z-10 m-3 mt-0! h-1 w-8 rounded-b-full transition-all md:m-6',
					highlightClasses
				)}
			/>
			<Card className={cn('relative h-full rounded-2xl', cardClassName)}>
				{children}
			</Card>
		</Component>
	)
}

export default BasicCard
