import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader
} from '@shared/components/ui/empty'
import { FolderOpen, Plus } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router'

import DashboardCard from '../../../components/dashboard/dashboard-card'
import {
	useProjectCreationCapabilities,
	useProjectsByOrganization,
	useSceneStats
} from '../../../hooks'

import { Route } from './+types/projects'

export async function loader({ request }: Route.LoaderArgs) {
	return null
}

const EmptyProjectsState = ({
	showCreateLink = false
}: {
	showCreateLink?: boolean
}) => (
	<Empty>
		<EmptyHeader>No projects found</EmptyHeader>
		<EmptyDescription>
			Get started by creating your first project.
		</EmptyDescription>
		<EmptyContent>
			{showCreateLink ? (
				<Link viewTransition to="/dashboard/projects/new">
					<Button>
						<Plus className="mr-2 h-4 w-4" />
						Create Your First Project
					</Button>
				</Link>
			) : (
				<Button disabled>
					<Plus className="mr-2 h-4 w-4" />
					Create Project
				</Button>
			)}
		</EmptyContent>
	</Empty>
)

const ProjectsPage = () => {
	const location = useLocation()
	const projectsByOrg = useProjectsByOrganization()

	const creationCapabilities = useProjectCreationCapabilities()
	const sceneStats = useSceneStats()

	// Check if we're at a child route like /new
	const isChildRoute = location.pathname.includes('/new')

	// If we're at a child route, only show the outlet
	if (isChildRoute) {
		return <Outlet />
	}

	return (
		<div className="p-6">
			{/* Projects by Organization */}
			{projectsByOrg.length > 0 ? (
				<div className="space-y-6">
					{projectsByOrg.map(({ organization, projects: orgProjects }) => (
						<div key={organization.id}>
							<div className="mb-3 flex items-center justify-between">
								<h3 className="text-md font-medium">
									<span className="bg-muted/50 mr-2 rounded-xl p-1 px-3">
										{organization.name}
									</span>
									projects:
								</h3>
								<Badge variant="outline">
									{orgProjects.length} project
									{orgProjects.length !== 1 ? 's' : ''}
								</Badge>
							</div>
							{orgProjects.length > 0 ? (
								<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
									{orgProjects.map(({ project }) => (
										<DashboardCard
											key={project.id}
											title={project.name}
											description={`Slug: ${project.slug}`}
											linkTo={`/dashboard/projects/${project.id}`}
											icon={<FolderOpen className="h-5 w-5" />}
											id={project.id}
										>
											<div className="space-y-2">
												<div className="text-sm text-gray-600">
													{sceneStats.byProject[project.id] || 0} scenes
												</div>
											</div>
										</DashboardCard>
									))}
								</div>
							) : (
								<EmptyProjectsState />
							)}
						</div>
					))}
				</div>
			) : (
				<EmptyProjectsState
					showCreateLink={creationCapabilities.canCreateProjects}
				/>
			)}
		</div>
	)
}

export default ProjectsPage
