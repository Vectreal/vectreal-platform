import { Button } from '@shared/components/ui/button'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader
} from '@shared/components/ui/empty'
import { Plus } from 'lucide-react'
import { Link, Outlet } from 'react-router'

import { Route } from './+types/projects'
import { DataTable } from '../../../components/dashboard/data-table'
import {
	projectColumns,
	type ProjectRow
} from '../../../components/dashboard/table-columns'
import { ProjectsGridSkeleton } from '../../../components/skeletons'
import { useDashboardTableState } from '../../../hooks/use-dashboard-table-state'
import { loadAuthenticatedSession } from '../../../lib/domain/auth/auth-loader.server'
import { computeProjectCreationCapabilities } from '../../../lib/domain/dashboard/dashboard-stats.server'
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
	return {
		organizations,
		projects: userProjects,
		scenes,
		projectCreationCapabilities
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

const ProjectsPage = ({ loaderData }: Route.ComponentProps) => {
	const { organizations, projects, projectCreationCapabilities, scenes } =
		loaderData
	const tableState = useDashboardTableState({
		namespace: 'projects-list'
	})

	const projectTableData: ProjectRow[] = projects.map(
		({ project, organizationId }) => {
			const projectScenes = scenes.filter(
				(scene) => scene.projectId === project.id
			)
			const latestSceneUpdate = projectScenes.reduce<Date | null>(
				(latest, scene) => {
					const sceneUpdatedAt = new Date(scene.updatedAt)

					if (!latest || sceneUpdatedAt > latest) {
						return sceneUpdatedAt
					}

					return latest
				},
				null
			)

			const stableTimestamp = latestSceneUpdate ?? new Date(0)

			return {
				id: project.id,
				name: project.name,
				organizationName:
					organizations.find(
						({ organization }) => organization.id === organizationId
					)?.organization.name || 'Unknown',
				sceneCount: projectScenes.length,
				createdAt: stableTimestamp,
				updatedAt: stableTimestamp
			}
		}
	)

	const canCreateProjects = Object.values(projectCreationCapabilities).some(
		(cap) => cap.canCreate
	)

	return (
		<>
			<div className="p-6">
				{projectTableData.length > 0 ? (
					<DataTable
						columns={projectColumns}
						data={projectTableData}
						searchKey="name"
						searchPlaceholder="Search projects..."
						searchValue={tableState.searchValue}
						onSearchValueChange={tableState.setSearchValue}
						sorting={tableState.sorting}
						onSortingChange={tableState.onSortingChange}
						pagination={tableState.pagination}
						onPaginationChange={tableState.onPaginationChange}
						rowSelection={tableState.rowSelection}
						onRowSelectionChange={tableState.onRowSelectionChange}
						onDelete={(selectedRows) => {
							console.log('Delete projects:', selectedRows)
							// TODO: Implement delete functionality
						}}
					/>
				) : (
					<EmptyProjectsState showCreateLink={canCreateProjects} />
				)}
			</div>
			<Outlet />
		</>
	)
}

export default ProjectsPage
