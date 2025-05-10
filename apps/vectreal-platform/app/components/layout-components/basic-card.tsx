import { Card } from '@vctrl-ui/ui/card'
import { cn } from '@vctrl-ui/utils'

interface BasicCardProps extends React.PropsWithChildren {
	className?: string
}

const BasicCard = ({ children, className }: BasicCardProps) => {
	return (
		<div className="group relative h-full">
			<div className="bg-accent/50 absolute top-0 left-0 m-3 mt-0! h-2 w-8 rounded-full blur-xl transition-all group-hover:w-16 md:m-6" />
			<div className="bg-accent absolute top-0 left-0 z-10 m-3 mt-0! h-1 w-8 rounded-b-full transition-all group-hover:w-16 md:m-6" />
			<Card
				className={cn(
					'bg-muted/50 border-t-accent/25 border-l-accent/10 relative h-full rounded-xl',
					className
				)}
			>
				<div className="from-accent/2 pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br to-transparent" />
				{children}
			</Card>
		</div>
	)
}
export default BasicCard
