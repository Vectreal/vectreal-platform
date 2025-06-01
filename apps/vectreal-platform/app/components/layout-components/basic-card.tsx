import { Card } from '@vctrl-ui/ui/card'
import { cn } from '@vctrl-ui/utils'
import { ComponentProps } from 'react'

interface BasicCardProps extends ComponentProps<'div'> {
	className?: string
	cardClassNames?: string
	highlight?: boolean
}

const BasicCard = ({
	children,
	className,
	cardClassNames,
	highlight,
	...props
}: BasicCardProps) => {
	return (
		<div className={cn('group relative', className)} {...props}>
			<div
				className={cn(
					'bg-accent/50 absolute top-0 left-0 m-3 mt-0! animate-pulse rounded-full blur-xl transition-all md:m-6',
					typeof highlight === 'boolean'
						? highlight
							? 'h-2 group-hover:w-16'
							: 'hidden'
						: 'h-[1px] w-8'
				)}
			/>
			<div
				className={cn(
					'bg-accent absolute top-0 left-0 z-10 m-3 mt-0! h-1 w-8 rounded-b-full transition-all md:m-6',
					typeof highlight === 'boolean'
						? highlight
							? 'h-1 group-hover:w-16'
							: 'hidden'
						: 'h-[1px] w-8'
				)}
			/>
			<Card
				className={cn(
					'bg-muted/50 border-t-accent/25 border-l-accent/10 relative h-full rounded-xl',
					cardClassNames
				)}
			>
				<div className="from-accent/2 pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br to-transparent" />
				{children}
			</Card>
		</div>
	)
}
export default BasicCard
