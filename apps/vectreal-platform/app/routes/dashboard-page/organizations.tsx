import { Badge } from '@vctrl-ui/ui/badge'
import { Building2, Settings, Users } from 'lucide-react'
import { Link } from 'react-router'

import DashboardCard from '../../components/dashboard/dashboard-card'
import {
	useOrganizations,
	useOrganizationStats,
	usePrimaryOrganization,
	useSortedOrganizations
} from '../../hooks'

import { Route } from './+types/organizations'

export async function loader({ request }: Route.LoaderArgs) {
	return null
}

const OrganizationsPage = () => {
	const organizations = useOrganizations()
	const sortedOrganizations = useSortedOrganizations()
	const primaryOrganization = usePrimaryOrganization()
	const stats = useOrganizationStats()

	// Debug logging
	console.log('Organizations data:', {
		organizations,
		sortedOrganizations,
		primaryOrganization,
		stats
	})

	return (
		<div className="p-6">
			{/* Stats Overview */}
			<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
				<div className="rounded-lg border p-4">
					<div className="flex items-center">
						<Building2 className="mr-2 h-5 w-5 text-blue-500" />
						<div>
							<p className="text-sm text-gray-600">Total Organizations</p>
							<p className="text-2xl font-bold">{stats.total}</p>
						</div>
					</div>
				</div>
				<div className="rounded-lg border p-4">
					<div className="flex items-center">
						<Users className="mr-2 h-5 w-5 text-green-500" />
						<div>
							<p className="text-sm text-gray-600">Organizations Owned</p>
							<p className="text-2xl font-bold">{stats.owned}</p>
						</div>
					</div>
				</div>
				<div className="rounded-lg border p-4">
					<div className="flex items-center">
						<Settings className="mr-2 h-5 w-5 text-purple-500" />
						<div>
							<p className="text-sm text-gray-600">Primary Role</p>
							<p className="text-2xl font-bold capitalize">
								{stats.primaryRole}
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Primary Organization */}
			{primaryOrganization && (
				<div className="mb-6">
					<h2 className="mb-3 text-lg font-semibold">Primary Organization</h2>
					<DashboardCard
						title={primaryOrganization.organization.name}
						description="Your primary workspace and default organization"
						linkTo={`/dashboard/organizations/${primaryOrganization.organization.id}`}
						icon={<Building2 className="h-5 w-5" />}
						id={primaryOrganization.organization.id}
					>
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-sm text-gray-600">Role</span>
								<Badge variant="default">
									{primaryOrganization.membership.role}
								</Badge>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-sm text-gray-600">Created</span>
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
				<h2 className="mb-3 text-lg font-semibold">All Organizations</h2>
				{organizations.length > 0 ? (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{sortedOrganizations.byRole.map(({ organization, membership }) => (
							<Link
								key={organization.id}
								to={`/dashboard/organizations/${organization.id}`}
								className="block"
							>
								<DashboardCard
									title={organization.name}
									description={`${membership.role} • Joined ${new Date(membership.joinedAt).toLocaleDateString()}`}
									linkTo={`/dashboard/organizations/${organization.id}`}
									icon={<Building2 className="h-5 w-5" />}
									id={organization.id}
								>
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<span className="text-sm text-gray-600">Role</span>
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
											<span className="text-sm text-gray-600">Owner</span>
											<span className="text-sm">
												{organization.ownerId === membership.userId
													? 'You'
													: 'Other'}
											</span>
										</div>
									</div>
								</DashboardCard>
							</Link>
						))}
					</div>
				) : (
					<div className="rounded-lg border border-gray-200 p-8 text-center">
						<Building2 className="mx-auto h-12 w-12 text-gray-400" />
						<h3 className="mt-2 text-lg font-medium text-gray-900">
							No organizations found
						</h3>
						<p className="mt-1 text-gray-500">
							You don't have access to any organizations yet.
						</p>
					</div>
				)}
			</div>
		</div>
	)
}

export default OrganizationsPage
