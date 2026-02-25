import { Button } from '@shared/components/ui/button'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader
} from '@shared/components/ui/empty'
import { FolderOpen, Plus } from 'lucide-react'
import { memo, useMemo } from 'react'
import { Link, Outlet, useLoaderData } from 'react-router'

import { Route } from './+types/projects'
import DashboardCard from '../../../components/dashboard/dashboard-cards'
import { ProjectsGridSkeleton } from '../../../components/skeletons'
import { loadAuthenticatedSession } from '../../../lib/domain/auth/auth-loader.server'
import {
	computeProjectCreationCapabilities,
	computeSceneStats
} from '../../../lib/domain/dashboard/dashboard-stats.server'
import { getUserProjects } from '../../../lib/domain/project/project-repository.server'
import { getProjectsScenes } from '../../../lib/domain/scene/scene-folder-repository.server'
import { getUserOrganizations } from '../../../lib/domain/user/user-repository.server'

import type { ShouldRevalidateFunction } from 'react-router'

export async function loader({ request }: Route.LoaderArgs) {
	const { user } = await loadAuthenticatedSession(request)

	// Fetch data needed for this specific route
	const [organizations, userProjects] = await Promise.all([
		getUserOrganizations(user.id),
		getUserProjects(user.id)
	])

	// Fetch scenes for all projects using batch query (eliminates N+1 problem)
	const projectIds = userProjects.map(({ project }) => project.id)
	const scenesByProject = await getProjectsScenes(projectIds, user.id)

	// Flatten scenes map to array
	const scenes = Array.from(scenesByProject.values()).flat()

	// Compute server-side
	const projectCreationCapabilities =
		computeProjectCreationCapabilities(organizations)
	const sceneStats = computeSceneStats(scenes)

	return {
		organizations,
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
	formMethod,
	actionResult,
	defaultShouldRevalidate
}) => {
	if (formMethod && formMethod !== 'GET') {
		return true
	}

	if (actionResult) {
		return true
	}

	if (defaultShouldRevalidate) {
		return true
	}

	if (currentUrl.pathname === nextUrl.pathname) {
		return false
	}

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
				<Link to="/dashboard/projects/new">
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

const ProjectsList = memo(() => {
	const { organizations, projects, projectCreationCapabilities, sceneStats } =
		useLoaderData<typeof loader>()

	// Group projects by organization client-side
	const projectsByOrg = useMemo(() => {
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
	}, [organizations, projects])

	// Check if user can create projects
	const canCreateProjects = Object.values(projectCreationCapabilities).some(
		(cap) => cap.canCreate
	)

	return (
		<div className="p-6">
			{/* Projects by Organization */}
			{projectsByOrg.length > 0 ? (
				<div className="space-y-6">
					{projectsByOrg.map(({ organization, projects: orgProjects }) => (
						<div key={organization.id}>
							<div className="mb-6 ml-2 flex items-center justify-between">
								<h3 className="text-md font-medium">
									<span className="text-accent">{organization.name}</span> with{' '}
									{orgProjects.length} project
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
})

ProjectsList.displayName = 'ProjectsList'

const ProjectsPage = () => {
	return (
		<>
			<ProjectsList />
			<Outlet />
		</>
	)
}

export default ProjectsPage
