import {
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
import { cn } from '@shared/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import { ChevronRight } from 'lucide-react'
import { FC, PropsWithChildren, type ReactNode } from 'react'
import { Link } from 'react-router'

import { BasicCard } from '../layout-components'

/**
 * Dashboard Card Variants using CVA for unified styling
 */
const dashboardCardVariants = cva('block group/card', {
	variants: {
		variant: {
			default: '',
			compact: '',
			detailed: ''
		},
		interactive: {
			true: 'transition-transform hover:scale-[1.02] active:scale-[0.98]',
			false: ''
		}
	},
	defaultVariants: {
		variant: 'default',
		interactive: true
	}
})

const cardHeaderVariants = cva('relative flex items-center', {
	variants: {
		variant: {
			default: 'gap-4',
			compact: 'gap-4',
			detailed: 'gap-4 flex-col items-start'
		}
	},
	defaultVariants: {
		variant: 'default'
	}
})

interface DashboardCardProps
	extends PropsWithChildren,
		VariantProps<typeof dashboardCardVariants> {
	linkTo: string
	title: string
	description: string
	icon: ReactNode
	id: string
	highlight?: boolean
	showId?: boolean
	className?: string
	/** Optional data to pass for optimistic header updates */
	navigationState?: import('../../types/dashboard').NavigationState
}

const DashboardCard: FC<DashboardCardProps> = ({
	linkTo,
	title,
	description,
	icon,
	id,
	highlight = true,
	showId = true,
	variant = 'default',
	interactive = true,
	className,
	navigationState,
	children
}) => {
	return (
		<Link
			to={linkTo}
			className={cn(dashboardCardVariants({ variant, interactive }), className)}
			viewTransition
			state={navigationState}
		>
			<BasicCard highlight={highlight}>
				<CardHeader className={cardHeaderVariants({ variant })}>
					<span className="grow space-y-1">
						<div className="flex items-center gap-2">
							<span className="text-primary/60 group-hover/card:text-primary transition-colors">
								{icon}
							</span>
							<CardTitle className="group-hover/card:text-primary transition-colors">
								{title}
							</CardTitle>
						</div>
						<CardDescription>{description}</CardDescription>
					</span>
					{variant !== 'detailed' && (
						<ChevronRight className="text-primary/60 h-4 w-4 transition-transform group-hover/card:translate-x-1" />
					)}
				</CardHeader>
				{children && <CardContent>{children}</CardContent>}
				{showId && (
					<CardFooter>
						<div className="flex w-full items-center justify-between gap-4">
							<code className="text-primary/25 truncate text-xs">{id}</code>
						</div>
					</CardFooter>
				)}
			</BasicCard>
		</Link>
	)
}

export default DashboardCard
export { dashboardCardVariants, type DashboardCardProps }
