import { useSetAtom } from 'jotai/react'
import { data, Link } from 'react-router'

import { Route } from './+types/dashboard-page'
import {
	DashboardOverview,
	DataTable,
	sceneColumns,
	type SceneRow
} from '../../components/dashboard'
import { DashboardSkeleton } from '../../components/skeletons'
import { useDashboardTableState } from '../../hooks/use-dashboard-table-state'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import { loadOrgUsage } from '../../lib/domain/billing/billing-dashboard-loader.server'
import { getOrgSubscription } from '../../lib/domain/billing/entitlement-service.server'
import {
	computeProjectStats,
	computeSceneStats,
	getRecentScenes
} from '../../lib/domain/dashboard/dashboard-stats.server'
import { getUserProjects } from '../../lib/domain/project/project-repository.server'
import { getProjectsScenes } from '../../lib/domain/scene/server/scene-folder-repository.server'
import { deleteDialogAtom } from '../../lib/stores/dashboard-management-store'

import type { ShouldRevalidateFunction } from 'react-router'

export async function loader({ request }: Route.LoaderArgs) {
	const { user, userWithDefaults, headers } = await loadAuthenticatedUser(request)

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

	// `loadOrgUsage` takes the projects and scenes already in hand rather than
	// re-fetching them, which is why it is a separate function from
	// `loadBillingDashboardData`.
	const organizationId = userWithDefaults.organization.id
	const [usage, { plan }] = await Promise.all([
		loadOrgUsage(organizationId, userProjects, scenes),
		getOrgSubscription(organizationId)
	])

	const projectNamesById = Object.fromEntries(
		userProjects.map(({ project }) => [project.id, project.name])
	)

	return data(
		{
			projects: userProjects,
			recentScenes,
			usage,
			plan,
			overview: {
				kpis: {
					totalProjects: projectStats.total,
					totalScenes: sceneStats.total,
					publishedScenes: sceneStats.byStatus.published,
					draftScenes: sceneStats.byStatus.draft
				},
				// The scene to offer as "jump back in". Computed here before, and
				// returned, but nothing ever read it.
				resumeScene: mostRecentScene
					? {
							id: mostRecentScene.id,
							projectId: mostRecentScene.projectId,
							name: mostRecentScene.name,
							status: mostRecentScene.status,
							thumbnailUrl: mostRecentScene.thumbnailUrl,
							updatedAt: mostRecentScene.updatedAt,
							projectName: projectNamesById[mostRecentScene.projectId] ?? ''
						}
					: null
			}
		},
		{ headers }
	)
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
	const { projects, recentScenes, overview, usage, plan } = loaderData
	const setDeleteDialog = useSetAtom(deleteDialogAtom)
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
			<DashboardOverview
				resumeScene={overview.resumeScene}
				usage={usage}
				plan={plan}
			/>

			{sceneTableData.length > 0 ? (
				<section className="space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h3 className="text-muted-foreground text-eyebrow">Recent work</h3>
						<Link
							to="/dashboard/projects"
							className="text-muted-foreground hover:text-foreground text-xs"
						>
							View all projects →
						</Link>
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
							setDeleteDialog({
								open: true,
								items: (selectedRows as SceneRow[]).map((row) => ({
									id: row.id,
									type: 'scene',
									name: row.name,
									projectId: row.projectId,
									folderId: null
								}))
							})
						}}
					/>
				</section>
			) : null}
			{/*
			  No second empty state here. With zero scenes the overview above already
			  shows the first-scene call to action; a "no recent scenes yet" panel
			  underneath it said the same thing again, without a way forward.
			*/}
		</div>
	)
}

export default DashboardPage
