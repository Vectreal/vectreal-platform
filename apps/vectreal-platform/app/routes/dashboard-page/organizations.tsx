import { Badge } from '@shared/components/ui/badge'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle
} from '@shared/components/ui/empty'
import { Building, Building2 } from 'lucide-react'
import { useMemo } from 'react'
import { data, Outlet, useLoaderData, useLocation } from 'react-router'

import { Route } from './+types/organizations'
import { DashboardCard } from '../../components/dashboard'
import { OrganizationsSkeleton } from '../../components/skeletons'
import { DASHBOARD_ROUTES } from '../../constants/dashboard'
import { loadAuthenticatedSession } from '../../lib/domain/auth/auth-loader.server'
import { getUserOrganizations } from '../../lib/domain/user/user-repository.server'

import type { ShouldRevalidateFunction } from 'react-router'

export async function loader({ request }: Route.LoaderArgs) {
	const { user, headers } = await loadAuthenticatedSession(request)

	// Fetch organizations
	const organizations = await getUserOrganizations(user.id)

	return data({ organizations }, { headers })
}

/**
 * Prevent revalidation on navigation - data comes from parent layout
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
	defaultShouldRevalidate: _defaultShouldRevalidate,
	formMethod
}) => {
	// Only revalidate on form submissions
	if (formMethod && formMethod !== 'GET') {
		return true
	}

	// Otherwise don't revalidate - data is cached
	return false
}

export function HydrateFallback() {
	return <OrganizationsSkeleton />
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

const OrganizationsPage = () => {
	const location = useLocation()
	const { organizations } = useLoaderData<typeof loader>()
	const isOrganizationsRootRoute = /^\/dashboard\/organizations\/?$/.test(
		location.pathname
	)

	// Sort organizations by role client-side
	const sortedOrganizations = useMemo(() => {
		const byRole = [...organizations].sort((a, b) => {
			const roleOrder = { owner: 3, admin: 2, member: 1 }
			return (
				roleOrder[b.membership.role as keyof typeof roleOrder] -
				roleOrder[a.membership.role as keyof typeof roleOrder]
			)
		})
		return { byRole }
	}, [organizations])

	if (!isOrganizationsRootRoute) {
		return <Outlet />
	}

	return (
		<div className="space-y-6 py-6">
			{/*
			  One list, and no counts above it.

			  Three stat cards - total, owner memberships, admin memberships - sat
			  directly on top of the list they were counting. Counting a list
			  rendered beneath you is not a second fact, and on a single-organization
			  account they read 1, 1, 0 above one row.

			  "Primary organization" went with them. It drew the same organization a
			  second time, in a second card, with different words - and the concept
			  was invented here: it meant "the first organization you own, by array
			  order", which is not something the product has. The list already marks
			  an owned organization by lifting it a step.
			*/}
			<section>
				{organizations.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Building />
							</EmptyMedia>
							<EmptyTitle>No organizations found</EmptyTitle>
							<EmptyDescription>
								You do not have access to any organizations yet.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<div className="grid gap-4 lg:grid-cols-2">
						{sortedOrganizations.byRole.map(({ organization, membership }) => (
							<DashboardCard
								key={organization.id}
								title={organization.name}
								description={`${membership.role} • Joined ${new Date(membership.joinedAt).toLocaleDateString()}`}
								linkTo={DASHBOARD_ROUTES.ORGANIZATION_DETAIL(organization.id)}
								icon={<Building2 className="h-5 w-5" />}
								id={organization.id}
								highlight={membership.role === 'owner'}
								navigationState={{
									name: organization.name,
									description: 'Organization details'
								}}
							>
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<span className="text-muted-foreground text-sm">Role</span>
										<Badge
											variant={
												membership.role === 'owner'
													? 'default'
													: membership.role === 'admin'
														? 'secondary'
														: 'outline'
											}
										>
											{membership.role}
										</Badge>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-muted-foreground text-sm">Owner</span>
										<span className="text-sm">
											{organization.ownerId === membership.userId
												? 'You'
												: 'Other'}
										</span>
									</div>
								</div>
							</DashboardCard>
						))}
					</div>
				)}
			</section>
		</div>
	)
}

export default OrganizationsPage
