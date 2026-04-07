import { Badge } from '@shared/components/ui/badge'
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
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
import { computeOrganizationStats } from '../../lib/domain/dashboard/dashboard-stats.server'
import { getUserOrganizations } from '../../lib/domain/user/user-repository.server'

import type { ShouldRevalidateFunction } from 'react-router'

export async function loader({ request }: Route.LoaderArgs) {
	const { user, headers } = await loadAuthenticatedSession(request)

	// Fetch organizations
	const organizations = await getUserOrganizations(user.id)

	// Compute stats server-side
	const organizationStats = computeOrganizationStats(organizations)

	return data(
		{
			user,
			organizations,
			organizationStats
		},
		{ headers }
	)
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
	const { organizations, organizationStats } = useLoaderData<typeof loader>()
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

	// Get primary organization (first owned org)
	const primaryOrganization = useMemo(() => {
		return (
			organizations.find(({ membership }) => membership.role === 'owner') ||
			null
		)
	}, [organizations])

	if (!isOrganizationsRootRoute) {
		return <Outlet />
	}

	return (
		<div className="space-y-6 p-6">
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Total organizations</CardDescription>
						<CardTitle>{organizationStats.total}</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Owner memberships</CardDescription>
						<CardTitle>{organizationStats.owned}</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Admin memberships</CardDescription>
						<CardTitle>{organizationStats.admin}</CardTitle>
					</CardHeader>
				</Card>
			</div>

			{primaryOrganization && (
				<section className="space-y-3">
					<h2 className="text-lg font-semibold">Primary organization</h2>
					<DashboardCard
						title={primaryOrganization.organization.name}
						description="Your default workspace and ownership context"
						linkTo={DASHBOARD_ROUTES.ORGANIZATION_DETAIL(
							primaryOrganization.organization.id
						)}
						icon={<Building2 className="h-5 w-5" />}
						id={primaryOrganization.organization.id}
						navigationState={{
							name: primaryOrganization.organization.name,
							description: 'Organization details'
						}}
					>
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-primary/60 text-sm">Role</span>
								<Badge variant="default">
									{primaryOrganization.membership.role}
								</Badge>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-primary/60 text-sm">Created</span>
								<span className="text-sm">
									{new Date(
										primaryOrganization.organization.createdAt
									).toLocaleDateString()}
								</span>
							</div>
						</div>
					</DashboardCard>
				</section>
			)}

			<section className="space-y-3">
				<h2 className="text-lg font-semibold">All organizations</h2>
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
										<span className="text-primary/60 text-sm">Role</span>
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
										<span className="text-primary/60 text-sm">Owner</span>
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
