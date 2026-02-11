import { Badge } from '@shared/components/ui/badge'
import { Building, Building2 } from 'lucide-react'
import { useMemo } from 'react'
import { useLoaderData } from 'react-router'
import type { ShouldRevalidateFunction } from 'react-router'

import DashboardCard from '../../components/dashboard/dashboard-cards'
import { OrganizationsSkeleton } from '../../components/skeletons'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import { computeOrganizationStats } from '../../lib/domain/dashboard/dashboard-stats.server'
import { getUserOrganizations } from '../../lib/domain/user/user-repository.server'

import { Route } from './+types/organizations'

export async function loader({ request }: Route.LoaderArgs) {
	// Auth check (reads from session, very cheap)
	const { user, userWithDefaults } = await loadAuthenticatedUser(request)

	// Fetch organizations
	const organizations = await getUserOrganizations(user.id)

	// Compute stats server-side
	const organizationStats = computeOrganizationStats(organizations)

	return {
		user,
		userWithDefaults,
		organizations,
		organizationStats
	}
}

/**
 * Prevent revalidation on navigation - data comes from parent layout
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
	defaultShouldRevalidate,
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
	const { organizations } = useLoaderData<typeof loader>()

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

	return (
		<div className="space-y-16 p-6">
			<div className="grid gap-4 lg:grid-cols-2">
				{/* Primary Organization */}
				{primaryOrganization && (
					<div className="space-y-2">
						<h2 className="text-lg font-semibold">Primary Organization</h2>
						<DashboardCard
							title={primaryOrganization.organization.name}
							description="Your primary workspace and default organization"
							linkTo={`/dashboard/organizations/${primaryOrganization.organization.id}`}
							icon={<Building2 className="h-5 w-5" />}
							id={primaryOrganization.organization.id}
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
					</div>
				)}

				{/* All Organizations */}
				<div>
					<h2 className="text-lg font-semibold">All Organizations</h2>
					{organizations.length > 0 ? (
						sortedOrganizations.byRole.map(({ organization, membership }) => (
							<DashboardCard
								key={organization.id}
								title={organization.name}
								description={`${membership.role} • Joined ${new Date(membership.joinedAt).toLocaleDateString()}`}
								linkTo={`/dashboard/organizations/${organization.id}`}
								icon={<Building2 className="h-5 w-5" />}
								id={organization.id}
								highlight={false}
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
						))
					) : (
						<div className="p-8 text-center">
							<Building className="text-primary/60 mx-auto h-12 w-12" />
							<h3 className="text-primary mt-2 text-lg font-medium">
								No organizations found
							</h3>
							<p className="text-primary/70 mt-1">
								You don't have access to any organizations yet.
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export default OrganizationsPage
