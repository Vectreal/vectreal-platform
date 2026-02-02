import {
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
import { ChevronRight } from 'lucide-react'
import { FC, PropsWithChildren } from 'react'
import { Link } from 'react-router'

import { BasicCard } from '../layout-components'

interface DashboardCardProps extends PropsWithChildren {
	linkTo: string
	title: string
	description: string
	icon: React.ReactNode
	id: string
}

const DashboardCard: FC<DashboardCardProps> = (props) => {
	return (
		<Link to={props.linkTo} className="block" viewTransition>
			<BasicCard highlight={true}>
				<CardHeader className="relative flex items-center gap-2">
					<span className="grow space-y-1">
						<CardTitle>{props.title}</CardTitle>
						<CardDescription>{props.description}</CardDescription>
					</span>
					<ChevronRight className="text-primary/60 h-4 w-4" />
				</CardHeader>
				<CardContent>{props.children}</CardContent>
				<CardFooter>
					<div className="flex w-full items-center justify-between gap-4">
						<code className="text-primary/25 truncate text-xs">{props.id}</code>
					</div>
				</CardFooter>
			</BasicCard>
		</Link>
	)
}

export default DashboardCard
