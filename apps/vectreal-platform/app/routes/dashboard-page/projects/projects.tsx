import { Button } from '@shared/components/ui/button'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader
} from '@shared/components/ui/empty'
import { FolderOpen, Plus } from 'lucide-react'
import { useMemo } from 'react'
import {
	Link,
	Outlet,
	useLoaderData,
	useLocation,
	useRouteLoaderData
} from 'react-router'
import type { ShouldRevalidateFunction } from 'react-router'

import DashboardCard from '../../../components/dashboard/dashboard-cards'
import { ProjectsGridSkeleton } from '../../../components/skeletons'
import { loadAuthenticatedUser } from '../../../lib/loaders/auth-loader.server'
import {
	computeProjectCreationCapabilities,
	computeSceneStats
} from '../../../lib/loaders/stats-helpers.server'
import { projectService } from '../../../lib/services/project-service.server'
import { sceneFolderService } from '../../../lib/services/scene-folder-service.server'
import { userService } from '../../../lib/services/user-service.server'
import type { loader as dashboardLayoutLoader } from '../../layouts/dashboard-layout'

import { Route } from './+types/projects'

export async function loader({ request }: Route.LoaderArgs) {
	// Auth check (reads from session, very cheap)
	const { user } = await loadAuthenticatedUser(request)

	// Fetch data needed for this specific route
	const [organizations, userProjects] = await Promise.all([
		userService.getUserOrganizations(user.id),
		projectService.getUserProjects(user.id)
	])

	// Fetch scenes for all projects using batch query (eliminates N+1 problem)
	const projectIds = userProjects.map(({ project }) => project.id)
	const scenesByProject = await sceneFolderService.getProjectsScenes(
		projectIds,
		user.id
	)

	// Flatten scenes map to array
	const scenes = Array.from(scenesByProject.values()).flat()

	// Compute server-side
	const projectCreationCapabilities =
		computeProjectCreationCapabilities(organizations)
	const sceneStats = computeSceneStats(scenes)

	return {
		projects: userProjects,
		scenes,
		projectCreationCapabilities,
		sceneStats
	}
}

/**
 * Prevent revalidation when navigating to child routes like /new
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	defaultShouldRevalidate
}) => {
	// Don't revalidate when navigating from /projects to /projects/new or similar
	if (
		currentUrl.pathname.startsWith('/dashboard/projects') &&
		nextUrl.pathname.startsWith('/dashboard/projects')
	) {
		return false
	}

	return defaultShouldRevalidate
}

export function HydrateFallback() {
	return <ProjectsGridSkeleton />
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../../components/errors'

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
	const { projects, projectCreationCapabilities, sceneStats } =
		useLoaderData<typeof loader>()

	// Access parent layout data for organizations
	const parentData = useRouteLoaderData<typeof dashboardLayoutLoader>(
		'routes/layouts/dashboard-layout'
	)

	// Group projects by organization client-side
	const projectsByOrg = useMemo(() => {
		const organizations = parentData?.organizations || []
		const grouped = new Map<
			string,
			{
				organization: (typeof organizations)[0]['organization']
				projects: (typeof projects)[0][]
			}
		>()

		// Initialize with all organizations
		organizations.forEach(({ organization }) => {
			grouped.set(organization.id, {
				organization,
				projects: []
			})
		})

		// Group projects by organization
		projects.forEach((projectWithOrg) => {
			const existing = grouped.get(projectWithOrg.organizationId)
			if (existing) {
				existing.projects.push(projectWithOrg)
			}
		})

		return Array.from(grouped.values())
	}, [projects, parentData])

	// Check if user can create projects
	const canCreateProjects = Object.values(projectCreationCapabilities).some(
		(cap) => cap.canCreate
	)

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
									with {orgProjects.length} project
									{orgProjects.length !== 1 ? 's' : ''}
								</h3>
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
											navigationState={{
												name: project.name,
												description: `Slug: ${project.slug}`,
												type: 'project' as const
											}}
										>
											<div className="space-y-2">
												<div className="text-primary/60 text-sm">
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
				<EmptyProjectsState showCreateLink={canCreateProjects} />
			)}
		</div>
	)
}

export default ProjectsPage
