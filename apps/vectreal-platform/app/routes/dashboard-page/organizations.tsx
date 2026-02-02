import { Badge } from '@shared/components/ui/badge'
import { Building, Building2, DogIcon, File } from 'lucide-react'

import DashboardCard from '../../components/dashboard/dashboard-card'
import StatCard from '../../components/dashboard/stat-card'
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

	const statCardsContent = [
		{
			icon: Building,
			value: stats.total,
			label: 'Organizations'
		},
		{
			icon: File,
			value: stats.owned,
			label: 'Previously Owned'
		},
		{
			icon: DogIcon,
			value: stats.primaryRole,
			label: 'Primary Role'
		}
	]

	return (
		<div className="space-y-16 p-6">
			{/* Stats Overview */}
			<div className="flex max-w-lg justify-between gap-4">
				{statCardsContent.map((stat) => (
					<StatCard
						key={stat.label}
						icon={stat.icon}
						value={stat.value}
						label={stat.label}
					/>
				))}
			</div>

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
