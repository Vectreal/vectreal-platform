import { File } from 'lucide-react'

import { Route } from './+types/dashboard-page'
import { DashboardOverview } from '../../components/dashboard/dashboard-overview'
import { DataTable } from '../../components/dashboard/data-table'
import {
	sceneColumns,
	type SceneRow
} from '../../components/dashboard/project-table-columns'
import { DashboardSkeleton } from '../../components/skeletons'
import { useDashboardTableState } from '../../hooks/use-dashboard-table-state'
import { loadAuthenticatedSession } from '../../lib/domain/auth/auth-loader.server'
import {
	computeProjectStats,
	computeSceneStats,
	getRecentScenes
} from '../../lib/domain/dashboard/dashboard-stats.server'
import { getUserProjects } from '../../lib/domain/project/project-repository.server'
import { getProjectsScenes } from '../../lib/domain/scene/scene-folder-repository.server'

import type { ShouldRevalidateFunction } from 'react-router'

export async function loader({ request }: Route.LoaderArgs) {
	const { user } = await loadAuthenticatedSession(request)

	const userProjects = await getUserProjects(user.id)

	// Fetch scenes for all projects using batch query (eliminates N+1 problem)
	const projectIds = userProjects.map(({ project }) => project.id)
	const scenesByProject = await getProjectsScenes(projectIds, user.id)

	// Flatten scenes map to array
	const scenes = Array.from(scenesByProject.values()).flat()

	const recentScenes = getRecentScenes(scenes, 10)
	const projectStats = computeProjectStats(userProjects)
	const sceneStats = computeSceneStats(scenes)
	const mostRecentScene = recentScenes[0]

	return {
		projects: userProjects,
		recentScenes,
		overview: {
			kpis: {
				totalProjects: projectStats.total,
				totalScenes: sceneStats.total,
				publishedScenes: sceneStats.byStatus.published,
				draftScenes: sceneStats.byStatus.draft
			},
			mostRecentSceneId: mostRecentScene?.id
		}
	}
}

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

	return defaultShouldRevalidate
}

export function HydrateFallback() {
	return <DashboardSkeleton />
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

const DashboardPage = ({ loaderData }: Route.ComponentProps) => {
	const { projects, recentScenes, overview } = loaderData
	const sceneTableState = useDashboardTableState({
		namespace: 'dashboard-scenes'
	})

	const sceneTableData: SceneRow[] = recentScenes.map((scene) => {
		const sceneProject = projects.find(
			({ project }) => project.id === scene.projectId
		)
		return {
			id: scene.id,
			name: scene.name,
			description: scene.description ?? undefined,
			projectId: scene.projectId,
			projectName: sceneProject?.project.name || 'Unknown',
			status: scene.status,
			thumbnailUrl: scene.thumbnailUrl ?? undefined,
			updatedAt: scene.updatedAt
		}
	})

	return (
		<div className="space-y-8 p-6">
			<DashboardOverview kpis={overview.kpis} />

			{sceneTableData.length > 0 ? (
				<section className="space-y-4">
					<div className="flex flex-col gap-1">
						<p className="text-muted-foreground text-sm tracking-tight">
							Recent scenes
						</p>
						<h3 className="text-xl font-semibold tracking-tight">
							Continue from your latest work
						</h3>
					</div>
					<DataTable
						columns={sceneColumns}
						data={sceneTableData}
						searchKey="name"
						searchPlaceholder="Search recent scenes..."
						searchValue={sceneTableState.searchValue}
						onSearchValueChange={sceneTableState.setSearchValue}
						sorting={sceneTableState.sorting}
						onSortingChange={sceneTableState.onSortingChange}
						pagination={sceneTableState.pagination}
						onPaginationChange={sceneTableState.onPaginationChange}
						rowSelection={sceneTableState.rowSelection}
						onRowSelectionChange={sceneTableState.onRowSelectionChange}
						onDelete={(selectedRows) => {
							console.log('Delete scenes:', selectedRows)
							// TODO: Implement delete functionality
						}}
						appearance="minimal"
					/>
				</section>
			) : (
				<div className="bg-muted/20 flex flex-col items-center justify-center rounded-3xl p-14 text-center">
					<div className="bg-muted/35 mb-5 flex h-16 w-16 items-center justify-center rounded-full">
						<File className="text-muted-foreground h-8 w-8" />
					</div>
					<h3 className="mb-2 text-xl font-semibold tracking-tight">
						No recent scenes yet
					</h3>
					<p className="text-muted-foreground max-w-sm text-sm sm:text-base">
						Create or update a scene to see it listed here.
					</p>
				</div>
			)}
		</div>
	)
}

export default DashboardPage
