import { Button } from '@shared/components/ui/button'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader
} from '@shared/components/ui/empty'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	data,
	Link,
	Outlet,
	useFetcher,
	useNavigate,
	useRevalidator,
	useSearchParams
} from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { toast } from 'sonner'

import { Route } from './+types/projects'
import {
	ProjectsBrowser,
	type ProjectBrowseItem,
	type ProjectRow,
	type StatusFilter
} from '../../../components/dashboard'
import { WrittenConfirmationModal } from '../../../components/shared/written-confirmation-modal'
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
import { ensureValidCsrfFormData } from '../../../lib/http/csrf.server'
import { shouldRevalidateWithinScope } from '../../../lib/navigation/dashboard-route-behavior'

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
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) {
		return csrfCheck
	}
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
	return shouldRevalidateWithinScope({
		currentPathname: currentUrl.pathname,
		nextPathname: nextUrl.pathname,
		formMethod,
		actionResult,
		defaultShouldRevalidate,
		scopePrefix: '/dashboard/projects'
	})
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
	const csrfToken = useAuthenticityToken()
	const revalidator = useRevalidator()
	const navigate = useNavigate()
	const lastHandledResponseRef = useRef<string | null>(null)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [projectIdsToDelete, setProjectIdsToDelete] = useState<string[]>([])
	const tableState = useDashboardTableState({
		namespace: 'projects-list'
	})
	const [searchParams, setSearchParams] = useSearchParams()
	const isDeletingProjects = fetcher.state !== 'idle'

	/*
	  Both filters live in the URL beside the rest of the table state, under the
	  same `projects-list` namespace, so a filtered view survives reload and
	  back-navigation and can be shared as a link.
	*/
	const organizationFilter = searchParams.get('projects-list-org') ?? 'all'
	const statusFilter = (searchParams.get('projects-list-status') ??
		'all') as StatusFilter

	const setFilterParam = useCallback(
		(key: string, value: string) => {
			setSearchParams((prevParams) => {
				const nextParams = new URLSearchParams(prevParams)
				if (value === 'all') {
					nextParams.delete(key)
				} else {
					nextParams.set(key, value)
				}
				// Narrowing the list while on page 3 would otherwise land on an empty
				// page, which reads as "no projects" rather than as a filter.
				nextParams.set('projects-list-page', '1')
				return nextParams
			})
		},
		[setSearchParams]
	)

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
				projectIds: JSON.stringify(projectIdsToDelete),
				csrf: csrfToken
			},
			{ method: 'post' }
		)
	}

	/*
	  Everything both layouts show, derived from data the loader already has.
	  No new queries: the scene rows are here for the counts, and the status
	  breakdown and card thumbnail come out of the same pass.
	*/
	const projectItems: ProjectBrowseItem[] = useMemo(
		() =>
			projects.map(({ project, organizationId }) => {
				const projectScenes = scenes.filter(
					(scene) => scene.projectId === project.id
				)

				const counts = { published: 0, draft: 0, archived: 0 }
				let latestSceneUpdate: Date | null = null
				let thumbnailUrl: null | string = null
				let thumbnailUpdatedAt: Date | null = null

				for (const scene of projectScenes) {
					if (scene.status in counts) {
						counts[scene.status as keyof typeof counts] += 1
					}

					const sceneUpdatedAt = new Date(scene.updatedAt)

					if (!latestSceneUpdate || sceneUpdatedAt > latestSceneUpdate) {
						latestSceneUpdate = sceneUpdatedAt
					}

					// The card borrows the most recently updated scene that actually has
					// a thumbnail, rather than the most recent scene - which is usually
					// the one just created, and so the one without a capture yet.
					if (
						scene.thumbnailUrl &&
						(!thumbnailUpdatedAt || sceneUpdatedAt > thumbnailUpdatedAt)
					) {
						thumbnailUrl = scene.thumbnailUrl
						thumbnailUpdatedAt = sceneUpdatedAt
					}
				}

				return {
					id: project.id,
					name: project.name,
					organizationId,
					organizationName:
						organizations.find(
							({ organization }) => organization.id === organizationId
						)?.organization.name || 'Unknown',
					canDelete:
						projectCreationCapabilities[organizationId]?.canDelete ?? false,
					sceneCount: projectScenes.length,
					counts,
					thumbnailUrl,
					// Null, not today. `projects` has no timestamp of its own, so a
					// project with no scenes genuinely has no date to report.
					updatedAt: latestSceneUpdate
				}
			}),
		[organizations, projectCreationCapabilities, projects, scenes]
	)

	const organizationOptions = useMemo(
		() =>
			organizations.map(({ organization }) => ({
				id: organization.id,
				name: organization.name
			})),
		[organizations]
	)

	const canCreateProjects = Object.values(projectCreationCapabilities).some(
		(cap) => cap.canCreate
	)

	return (
		<>
			<div className="p-6">
				{projectItems.length > 0 ? (
					<ProjectsBrowser
						items={projectItems}
						organizations={organizationOptions}
						tableState={tableState}
						organizationFilter={organizationFilter}
						onOrganizationFilterChange={(value) =>
							setFilterParam('projects-list-org', value)
						}
						statusFilter={statusFilter}
						onStatusFilterChange={(value) =>
							setFilterParam('projects-list-status', value)
						}
						isUpdating={isDeletingProjects}
						// Rename opens the edit dialog that already exists at this route's
						// `/edit` child. The button used to render with nothing behind it,
						// because the page never passed a handler.
						onRename={(row: ProjectRow) =>
							navigate(`/dashboard/projects/${row.id}/edit`)
						}
						onDelete={(selectedRows: ProjectRow[]) => {
							const projectIds = selectedRows.map((row) => row.id)

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
			<WrittenConfirmationModal
				open={deleteDialogOpen}
				onOpenChange={(open) => {
					setDeleteDialogOpen(open)
					if (!open && !isDeletingProjects) {
						setProjectIdsToDelete([])
					}
				}}
				title="Delete Projects"
				description={
					projectIdsToDelete.length === 1
						? 'Delete this project and all nested data? This action cannot be undone.'
						: `Delete ${projectIdsToDelete.length} selected projects and all nested data? This action cannot be undone.`
				}
				confirmationText="DELETE"
				confirmLabel="Delete"
				isPending={isDeletingProjects}
				onConfirm={() => {
					confirmDeleteProjects()
				}}
			/>
			<Outlet />
		</>
	)
}

export default ProjectsPage
