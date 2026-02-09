import { Button } from '@shared/components/ui/button'
import { Separator } from '@shared/components/ui/separator'
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger
} from '@shared/components/ui/tabs'
import { File, FolderOpen, Plus } from 'lucide-react'
import { Link, useLoaderData, useRouteLoaderData } from 'react-router'

import DashboardCard from '../../components/dashboard/dashboard-cards'
import { DataTable } from '../../components/dashboard/data-table'
import {
	projectColumns,
	type ProjectRow,
	sceneColumns,
	type SceneRow
} from '../../components/dashboard/project-table-columns'
import { DashboardSkeleton } from '../../components/skeletons'
import { loadAuthenticatedUser } from '../../lib/loaders/auth-loader.server'
import {
	computeProjectStats,
	computeSceneStats,
	getRecentProjects,
	getRecentScenes
} from '../../lib/loaders/stats-helpers.server'
import { projectService } from '../../lib/services/project-service.server'
import { sceneFolderService } from '../../lib/services/scene-folder-service.server'
import type { loader as dashboardLayoutLoader } from '../layouts/dashboard-layout'

import { Route } from './+types/dashboard'

export async function loader({ request }: Route.LoaderArgs) {
	// Auth check (reads from session, very cheap)
	const { user } = await loadAuthenticatedUser(request)

	// Fetch user projects (parent already fetched this, but we need it for the batch query)
	const userProjects = await projectService.getUserProjects(user.id)

	// Fetch scenes for all projects using batch query (eliminates N+1 problem)
	const projectIds = userProjects.map(({ project }) => project.id)
	const scenesByProject = await sceneFolderService.getProjectsScenes(
		projectIds,
		user.id
	)

	// Flatten scenes map to array
	const scenes = Array.from(scenesByProject.values()).flat()

	// Compute stats server-side
	const projectStats = computeProjectStats(userProjects)
	const sceneStats = computeSceneStats(scenes)
	const recentProjects = getRecentProjects(userProjects, 3)
	const recentScenes = getRecentScenes(scenes, 3)

	return {
		projects: userProjects,
		scenes,
		projectStats,
		sceneStats,
		recentProjects,
		recentScenes
	}
}

export function HydrateFallback() {
	return <DashboardSkeleton />
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

const DashboardPage = () => {
	const { projects, scenes, projectStats, sceneStats, recentScenes } =
		useLoaderData<typeof loader>()

	// Access parent layout data for organizations
	const parentData = useRouteLoaderData<typeof dashboardLayoutLoader>(
		'routes/layouts/dashboard-layout'
	)
	const organizations = parentData?.organizations || []

	// Transform data for tables
	const projectTableData: ProjectRow[] = projects.map(
		({ project, organizationId }) => ({
			id: project.id,
			name: project.name,
			organizationName:
				organizations.find(
					({ organization }) => organization.id === organizationId
				)?.organization.name || 'Unknown',
			sceneCount: scenes.filter((s) => s.projectId === project.id).length,
			createdAt: new Date(),
			updatedAt: new Date()
		})
	)

	const sceneTableData: SceneRow[] = scenes.map((scene) => {
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
		<div className="space-y-10 p-6">
			{/* Recent Access Section */}
			{recentScenes.length > 0 && (
				<section className="space-y-6">
					{/* Recent Scenes */}
					{recentScenes.length > 0 && (
						<div className="flex flex-col items-end gap-4">
							<div className="grid w-full gap-4 md:grid-cols-2 lg:grid-cols-3">
								{recentScenes.map((scene) => {
									const sceneProject = projects.find(
										({ project }) => project.id === scene.projectId
									)
									return (
										<DashboardCard
											key={scene.id}
											title={scene.name}
											description={scene.description || 'No description'}
											linkTo={`/dashboard/projects/${scene.projectId}/${scene.id}`}
											icon={<File className="h-5 w-5" />}
											id={scene.id}
											variant="compact"
											showId={false}
											navigationState={{
												name: scene.name,
												description: scene.description || undefined,
												projectName: sceneProject?.project.name,
												type: 'scene' as const
											}}
										/>
									)
								})}
							</div>
							<Link viewTransition to="/dashboard/projects">
								<Button variant="ghost" size="sm">
									View All
								</Button>
							</Link>
						</div>
					)}
				</section>
			)}

			{/* All Items with Filtering and Batch Operations */}
			<Separator className="bg-border/50" />
			<section className="space-y-6">
				<Tabs defaultValue="projects" className="w-full">
					<TabsList className="grid w-full max-w-md grid-cols-2">
						<TabsTrigger value="scenes" className="gap-2">
							<File className="h-4 w-4" />
							Scenes ({sceneStats.total})
						</TabsTrigger>
						<TabsTrigger value="projects" className="gap-2">
							<FolderOpen className="h-4 w-4" />
							Projects ({projectStats.total})
						</TabsTrigger>
					</TabsList>

					<TabsContent value="projects" className="mt-6">
						{projectTableData.length > 0 ? (
							<DataTable
								columns={projectColumns}
								data={projectTableData}
								searchKey="name"
								searchPlaceholder="Search projects..."
								onDelete={(selectedRows) => {
									console.log('Delete projects:', selectedRows)
									// TODO: Implement delete functionality
								}}
							/>
						) : (
							<div className="bg-muted/5 flex flex-col items-center justify-center rounded-xl border p-12 text-center backdrop-blur-sm">
								<div className="bg-primary/10 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
									<FolderOpen className="text-primary/60 h-8 w-8" />
								</div>
								<h3 className="mb-2 text-lg font-semibold">No projects yet</h3>
								<p className="text-muted-foreground mb-4 max-w-sm">
									Get started by creating your first project to organize your
									scenes and assets.
								</p>
								<Link to="/dashboard/projects/new">
									<Button>
										<Plus className="mr-2 h-4 w-4" />
										Create Your First Project
									</Button>
								</Link>
							</div>
						)}
					</TabsContent>

					<TabsContent value="scenes" className="mt-6">
						{sceneTableData.length > 0 ? (
							<DataTable
								columns={sceneColumns}
								data={sceneTableData}
								searchKey="name"
								searchPlaceholder="Search scenes..."
								onDelete={(selectedRows) => {
									console.log('Delete scenes:', selectedRows)
									// TODO: Implement delete functionality
								}}
							/>
						) : (
							<div className="bg-muted/5 flex flex-col items-center justify-center rounded-xl border p-12 text-center backdrop-blur-sm">
								<div className="bg-primary/10 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
									<File className="text-primary/60 h-8 w-8" />
								</div>
								<h3 className="mb-2 text-lg font-semibold">No scenes yet</h3>
								<p className="text-muted-foreground mb-4 max-w-sm">
									Create a project first, then add scenes to bring your ideas to
									life.
								</p>
								<Link to="/dashboard/projects/new">
									<Button>
										<Plus className="mr-2 h-4 w-4" />
										Create a Project
									</Button>
								</Link>
							</div>
						)}
					</TabsContent>
				</Tabs>
			</section>
		</div>
	)
}

export default DashboardPage
