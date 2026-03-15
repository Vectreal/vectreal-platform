import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle
} from '@shared/components/ui/alert-dialog'
import { Button } from '@shared/components/ui/button'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader
} from '@shared/components/ui/empty'
import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { data, Link, Outlet, useFetcher, useRevalidator } from 'react-router'
import { toast } from 'sonner'

import { Route } from './+types/projects'
import { DataTable } from '../../../components/dashboard/data-table'
import {
	projectColumns,
	type ProjectRow
} from '../../../components/dashboard/table-columns'
import { ProjectsGridSkeleton } from '../../../components/skeletons'
import { useDashboardTableState } from '../../../hooks/use-dashboard-table-state'
import {
	loadAuthenticatedSession,
	loadAuthenticatedUser
} from '../../../lib/domain/auth/auth-loader.server'
import {
	getOrgSubscription,
	getQuotaLimit,
	getRecommendedUpgrade
} from '../../../lib/domain/billing/entitlement-service.server'
import { computeProjectCreationCapabilities } from '../../../lib/domain/dashboard/dashboard-stats.server'
import {
	deleteProject,
	getUserProjects
} from '../../../lib/domain/project/project-repository.server'
import { getProjectsScenes } from '../../../lib/domain/scene/server/scene-folder-repository.server'
import { getUserOrganizations } from '../../../lib/domain/user/user-repository.server'

import type { ShouldRevalidateFunction } from 'react-router'

export async function loader({ request }: Route.LoaderArgs) {
	const { user, headers } = await loadAuthenticatedSession(request)

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

	const projectsTotalByOrganization = userProjects.reduce<
		Record<string, number>
	>((acc, { organizationId }) => {
		acc[organizationId] = (acc[organizationId] || 0) + 1
		return acc
	}, {})

	const quotaEntries = await Promise.all(
		organizations.map(async ({ organization }) => {
			const [quota, subscription] = await Promise.all([
				getQuotaLimit(organization.id, 'projects_total'),
				getOrgSubscription(organization.id)
			])
			return [
				organization.id,
				{
					projectsLimit: quota.limit,
					plan: subscription.plan,
					upgradeTo: getRecommendedUpgrade(subscription.plan)
				}
			] as const
		})
	)

	const projectQuotaByOrganization = Object.fromEntries(
		quotaEntries.map(([organizationId, quota]) => [
			organizationId,
			{
				projectsTotal: projectsTotalByOrganization[organizationId] || 0,
				projectsLimit: quota.projectsLimit,
				plan: quota.plan,
				upgradeTo: quota.upgradeTo
			}
		])
	)

	// Compute server-side
	const projectCreationCapabilities = computeProjectCreationCapabilities(
		organizations,
		projectQuotaByOrganization
	)
	return data(
		{
			organizations,
			projects: userProjects,
			scenes,
			projectCreationCapabilities
		},
		{ headers }
	)
}

interface ProjectDeleteResult {
	id: string
	success: boolean
	error?: string
}

interface ProjectDeleteActionResponse {
	success: boolean
	summary: {
		total: number
		succeeded: number
		failed: number
	}
	results: ProjectDeleteResult[]
	error?: string
}

export async function action({ request }: Route.ActionArgs) {
	const { user, headers } = await loadAuthenticatedUser(request)
	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent !== 'bulk-delete') {
		return data(
			{
				success: false,
				error: 'Invalid intent',
				summary: {
					total: 0,
					succeeded: 0,
					failed: 0
				},
				results: []
			} satisfies ProjectDeleteActionResponse,
			{ headers }
		)
	}

	const projectIdsRaw = formData.get('projectIds')
	if (typeof projectIdsRaw !== 'string' || !projectIdsRaw.trim()) {
		return data(
			{
				success: false,
				error: 'Project IDs are required',
				summary: {
					total: 0,
					succeeded: 0,
					failed: 0
				},
				results: []
			} satisfies ProjectDeleteActionResponse,
			{ headers }
		)
	}

	let projectIds: string[]
	try {
		const parsed = JSON.parse(projectIdsRaw)
		if (
			!Array.isArray(parsed) ||
			!parsed.every((id) => typeof id === 'string')
		) {
			throw new Error('Invalid project IDs payload')
		}
		projectIds = parsed
	} catch {
		return data(
			{
				success: false,
				error: 'Invalid project IDs payload',
				summary: {
					total: 0,
					succeeded: 0,
					failed: 0
				},
				results: []
			} satisfies ProjectDeleteActionResponse,
			{ headers }
		)
	}

	if (projectIds.length === 0) {
		return data(
			{
				success: false,
				error: 'At least one project must be selected',
				summary: {
					total: 0,
					succeeded: 0,
					failed: 0
				},
				results: []
			} satisfies ProjectDeleteActionResponse,
			{ headers }
		)
	}

	const results: ProjectDeleteResult[] = []

	for (const projectId of projectIds) {
		try {
			await deleteProject(projectId, user.id)
			results.push({ id: projectId, success: true })
		} catch (error) {
			results.push({
				id: projectId,
				success: false,
				error:
					error instanceof Error ? error.message : 'Failed to delete project'
			})
		}
	}

	const succeeded = results.filter((result) => result.success).length

	return data(
		{
			success: succeeded > 0,
			summary: {
				total: results.length,
				succeeded,
				failed: results.length - succeeded
			},
			results
		} satisfies ProjectDeleteActionResponse,
		{ headers }
	)
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
	const fetcher = useFetcher<typeof action>()
	const revalidator = useRevalidator()
	const lastHandledResponseRef = useRef<string | null>(null)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [projectIdsToDelete, setProjectIdsToDelete] = useState<string[]>([])
	const tableState = useDashboardTableState({
		namespace: 'projects-list'
	})
	const isDeletingProjects = fetcher.state !== 'idle'

	useEffect(() => {
		if (fetcher.state !== 'idle' || !fetcher.data) {
			return
		}

		const signature = JSON.stringify(fetcher.data)
		if (lastHandledResponseRef.current === signature) {
			return
		}
		lastHandledResponseRef.current = signature

		if (!fetcher.data.success) {
			const errorMessage =
				'error' in fetcher.data && typeof fetcher.data.error === 'string'
					? fetcher.data.error
					: 'Failed to delete projects'
			toast.error(errorMessage)
			return
		}

		if (fetcher.data.summary.failed > 0) {
			toast.warning(
				`${fetcher.data.summary.succeeded}/${fetcher.data.summary.total} projects deleted, ${fetcher.data.summary.failed} failed`
			)
		} else {
			toast.success(`${fetcher.data.summary.succeeded} project(s) deleted`)
		}

		if (fetcher.data.summary.succeeded > 0) {
			setDeleteDialogOpen(false)
			setProjectIdsToDelete([])
			revalidator.revalidate()
		}
	}, [fetcher.state, fetcher.data, revalidator])

	const confirmDeleteProjects = () => {
		if (projectIdsToDelete.length === 0 || isDeletingProjects) {
			return
		}

		fetcher.submit(
			{
				intent: 'bulk-delete',
				projectIds: JSON.stringify(projectIdsToDelete)
			},
			{ method: 'post' }
		)
	}

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
				canDelete:
					projectCreationCapabilities[organizationId]?.canDelete ?? false,
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
						isUpdating={isDeletingProjects}
						disableSelectionActions={isDeletingProjects}
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
						getRowCanSelect={(row) => row.canDelete}
						onDelete={(selectedRows) => {
							const projectIds = (selectedRows as ProjectRow[]).map(
								(row) => row.id
							)

							if (projectIds.length === 0) {
								toast.error('Select at least one project first')
								return
							}

							setProjectIdsToDelete(projectIds)
							setDeleteDialogOpen(true)
						}}
					/>
				) : (
					<EmptyProjectsState showCreateLink={canCreateProjects} />
				)}
			</div>
			<AlertDialog
				open={deleteDialogOpen}
				onOpenChange={(open) => {
					setDeleteDialogOpen(open)
					if (!open && !isDeletingProjects) {
						setProjectIdsToDelete([])
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Projects</AlertDialogTitle>
						<AlertDialogDescription>
							{projectIdsToDelete.length === 1
								? 'Delete this project? This action cannot be undone.'
								: `Delete ${projectIdsToDelete.length} selected projects? This action cannot be undone.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeletingProjects}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmDeleteProjects}
							disabled={isDeletingProjects}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<Outlet />
		</>
	)
}

export default ProjectsPage
