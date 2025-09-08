import { Badge } from '@vctrl-ui/ui/badge'
import { Button } from '@vctrl-ui/ui/button'
import { FolderOpen, Plus, Settings } from 'lucide-react'
import { Link } from 'react-router'

import DashboardCard from '../../components/dashboard/dashboard-card'
import {
	useDefaultProject,
	useProjectCreationCapabilities,
	useProjectsByOrganization,
	useProjectStats
} from '../../hooks'

import { Route } from './+types/projects'

export async function loader({ request }: Route.LoaderArgs) {
	return null
}

const ProjectsPage = () => {
	const projectsByOrg = useProjectsByOrganization()
	const projectStats = useProjectStats()
	const defaultProject = useDefaultProject()
	const creationCapabilities = useProjectCreationCapabilities()

	// Debug logging
	console.log('Projects data:', {
		projectsByOrg,
		projectStats,
		defaultProject,
		creationCapabilities
	})

	return (
		<div className="p-6">
			{/* Projects by Organization */}
			<div>
				{projectsByOrg.length > 0 ? (
					<div className="space-y-6">
						{projectsByOrg.map(({ organization, projects: orgProjects }) => (
							<div key={organization.id}>
								<div className="mb-3 flex items-center justify-between">
									<h3 className="text-md font-medium">
										<span className="bg-muted/50 mr-2 rounded-xl p-1 px-3">
											{organization.name}
										</span>
										contains:
									</h3>
									<Badge variant="outline">
										{orgProjects.length} project
										{orgProjects.length !== 1 ? 's' : ''}
									</Badge>
								</div>
								{orgProjects.length > 0 ? (
									<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
										{orgProjects.map(({ project }) => (
											<Link
												key={project.id}
												to={`/dashboard/projects/${project.id}`}
												className="block"
											>
												<DashboardCard
													title={project.name}
													description={`Slug: ${project.slug}`}
													linkTo={`/dashboard/projects/${project.id}`}
													icon={<FolderOpen className="h-5 w-5" />}
													id={project.id}
												>
													<div className="space-y-2"></div>
												</DashboardCard>
											</Link>
										))}
									</div>
								) : (
									<div className="rounded-lg border border-gray-200 p-6 text-center">
										<FolderOpen className="mx-auto h-8 w-8 text-gray-400" />
										<p className="mt-2 text-sm text-gray-500">
											No projects in this organization
										</p>
										{creationCapabilities.availableOrganizations.some(
											(org) => org.id === organization.id
										) && (
											<Link
												to={`/dashboard/projects/new?org=${organization.id}`}
											>
												<Button variant="outline" size="sm" className="mt-2">
													<Plus className="mr-1 h-3 w-3" />
													Create Project
												</Button>
											</Link>
										)}
									</div>
								)}
							</div>
						))}
					</div>
				) : (
					<div className="rounded-lg border border-gray-200 p-8 text-center">
						<FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
						<h3 className="mt-2 text-lg font-medium text-gray-900">
							No projects found
						</h3>
						<p className="mt-1 text-gray-500">
							Get started by creating your first project.
						</p>
						{creationCapabilities.canCreateProjects && (
							<Link to="/dashboard/projects/new">
								<Button className="mt-4">
									<Plus className="mr-2 h-4 w-4" />
									Create Your First Project
								</Button>
							</Link>
						)}
					</div>
				)}
			</div>
		</div>
	)
}

export default ProjectsPage
