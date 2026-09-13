import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
import { cn } from '@shared/utils'
import { ChevronRight } from 'lucide-react'
import { FC, PropsWithChildren, type ReactNode } from 'react'
import { Link } from 'react-router'

/**
 * A card that links somewhere, used by the organizations list.
 *
 * It used to declare a `variant` of `default | compact | detailed` and an
 * `interactive` boolean. No call site ever passed either, and `default` and
 * `compact` compiled to the same string in both of the CVA blocks that read
 * them, so of the six declared combinations one was reachable and two were
 * indistinguishable. What is left needs no CVA.
 *
 * `highlight` is real - `organizations.tsx` passes it for an organization the
 * viewer owns - so it stays, implemented the way `elevation.md` describes
 * rather than by stacking a second ladder class on the same element. The step
 * goes on the wrapper and the `ds-raised` `Card` inside it resolves to 8% by
 * the ladder's nesting rule. It mattered: `ds-*` are `@layer components`
 * classes and are not registered with tailwind-merge (`styling.utils.ts`
 * registers `z`, `container` and `text` only), so `cn('ds-raised', 'ds-overlay')`
 * emitted both and left stylesheet order to pick the winner.
 */
interface DashboardCardProps extends PropsWithChildren {
	linkTo: string
	title: string
	description: string
	icon: ReactNode
	id: string
	/** Lifts the card one step, for the organization the viewer owns. */
	highlight?: boolean
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
	className,
	navigationState,
	children
}) => {
	return (
		<Link
			to={linkTo}
			className={cn('group/card block', highlight && 'ds-raised', className)}
			viewTransition
			state={navigationState}
		>
			<Card className="group relative h-full overflow-hidden rounded-2xl">
				<CardHeader className="relative flex items-center gap-4">
					<span className="grow space-y-1 overflow-hidden">
						<div className="flex items-center gap-2">
							<span className="text-muted-foreground group-hover/card:text-foreground transition-colors">
								{icon}
							</span>
							<CardTitle className="group-hover/card:text-foreground transition-colors">
								{title}
							</CardTitle>
						</div>
						<CardDescription className="relative w-full truncate">
							{description}
						</CardDescription>
					</span>
					<ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover/card:translate-x-1" />
				</CardHeader>
				{children && <CardContent>{children}</CardContent>}
				<CardFooter>
					<div className="flex w-full items-center justify-between gap-4">
						<code className="text-muted-foreground truncate text-xs">{id}</code>
					</div>
				</CardFooter>
			</Card>
		</Link>
	)
}

export default DashboardCard
export { type DashboardCardProps }
