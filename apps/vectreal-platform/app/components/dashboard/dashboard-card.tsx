import {
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle
} from '@vctrl-ui/ui/card'
import { ChevronRight } from 'lucide-react'
import { FC, PropsWithChildren } from 'react'
import { Link } from 'react-router'

import { BasicCard } from '../layout-components'

interface DashboardCardProps extends PropsWithChildren {
	title: string
	linkTo: string
	description: string
	icon: React.ReactNode
	id: string
}

const DashboardCard: FC<DashboardCardProps> = (props) => {
	return (
		<Link to={props.linkTo} className="block" viewTransition>
			<BasicCard highlight={true}>
				<CardHeader className="relative flex items-center gap-2">
					<span className="grow">
						<CardTitle>{props.title}</CardTitle>
						<CardDescription>{props.description}</CardDescription>
					</span>
					<ChevronRight className="h-4 w-4 text-gray-500" />
				</CardHeader>
				<CardContent>{props.children}</CardContent>
				<CardFooter>
					<div className="flex w-full items-center gap-4">
						<span className="text-sm text-gray-600">ID</span>
						<code className="grow text-xs">{props.id.slice(0, 24)}...</code>
					</div>
				</CardFooter>
			</BasicCard>
		</Link>
	)
}

export default DashboardCard
