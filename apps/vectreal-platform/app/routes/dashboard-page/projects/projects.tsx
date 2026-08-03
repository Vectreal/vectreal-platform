import { Button } from '@shared/components/ui/button'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader
} from '@shared/components/ui/empty'
import { useSetAtom } from 'jotai/react'
import { Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { data, Link, Outlet, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { Route } from './+types/projects'
import {
	ProjectsBrowser,
	type ProjectBrowseItem,
	type ProjectRow,
	type StatusFilter
} from '../../../components/dashboard'
import { ConfirmDestructiveDialog } from '../../../components/shared/confirm-destructive-dialog'
import { ProjectsGridSkeleton } from '../../../components/skeletons'
import { useDashboardMutations } from '../../../hooks/use-dashboard-mutations'
import { useDashboardTableState } from '../../../hooks/use-dashboard-table-state'
import { loadAuthenticatedSession } from '../../../lib/domain/auth/auth-loader.server'
import {
	getOrgSubscription,
	getQuotaLimit,
	getRecommendedUpgrade
} from '../../../lib/domain/billing/entitlement-service.server'
import { buildDashboardCapabilities } from '../../../lib/domain/dashboard/dashboard-capabilities'
import {
	planDeleteConfirmation,
	toProjectRef
} from '../../../lib/domain/dashboard/dashboard-confirmation'
import { getUserProjects } from '../../../lib/domain/project/project-repository.server'
import { getProjectsScenes } from '../../../lib/domain/scene/server/scene-folder-repository.server'
import { getUserOrganizations } from '../../../lib/domain/user/user-repository.server'
import { shouldRevalidateWithinScope } from '../../../lib/navigation/dashboard-route-behavior'
import { renameDialogAtom } from '../../../lib/stores/dashboard-management-store'

import type { DashboardEntityRef } from '../../../lib/domain/dashboard/dashboard-confirmation'
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
	const projectCreationCapabilities = buildDashboardCapabilities(
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
	const setRenameDialog = useSetAtom(renameDialogAtom)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	// Refs rather than ids: the confirmation copy needs each project's scene and
	// published counts to say what deleting it actually costs.
	const [projectsToDelete, setProjectsToDelete] = useState<
		DashboardEntityRef[]
	>([])
	const tableState = useDashboardTableState({
		namespace: 'projects-list'
	})
	const [searchParams, setSearchParams] = useSearchParams()

	const mutations = useDashboardMutations({
		onSuccess: () => {
			setDeleteDialogOpen(false)
			setProjectsToDelete([])
		}
	})
	const isDeletingProjects = mutations.state !== 'idle'

	const deletePlan = useMemo(
		() => planDeleteConfirmation(projectsToDelete),
		[projectsToDelete]
	)

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

	const confirmDeleteProjects = (confirmationText: string | null) => {
		if (projectsToDelete.length === 0 || isDeletingProjects) {
			return
		}

		mutations.submit({
			verb: 'delete',
			targets: projectsToDelete.map((project) => ({
				type: 'project' as const,
				id: project.id
			})),
			confirmationText
		})
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
						projectCreationCapabilities[organizationId]?.canDeleteProject ??
						false,
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
		(cap) => cap.canCreateProject
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
						/*
						  The same inline dialog scenes and folders use. Renaming a
						  project used to open the whole edit drawer, whose save then
						  redirected into the project - so renaming from the list moved
						  you off it. The drawer still owns slug and embed domains.
						*/
						onRename={(row: ProjectRow) =>
							setRenameDialog({
								open: true,
								item: toProjectRef(row),
								name: row.name
							})
						}
						onDelete={(selectedRows: ProjectRow[]) => {
							if (selectedRows.length === 0) {
								toast.error('Select at least one project first')
								return
							}

							setProjectsToDelete(selectedRows.map(toProjectRef))
							setDeleteDialogOpen(true)
						}}
					/>
				) : (
					<EmptyProjectsState showCreateLink={canCreateProjects} />
				)}
			</div>
			<ConfirmDestructiveDialog
				open={deleteDialogOpen}
				onOpenChange={(open) => {
					if (!open && isDeletingProjects) {
						return
					}
					setDeleteDialogOpen(open)
					if (!open) {
						setProjectsToDelete([])
					}
				}}
				plan={deletePlan}
				isPending={isDeletingProjects}
				errorMessage={mutations.lastError}
				onConfirm={confirmDeleteProjects}
			/>
			<Outlet />
		</>
	)
}

export default ProjectsPage
