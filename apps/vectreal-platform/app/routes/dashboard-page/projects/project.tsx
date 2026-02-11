import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader
} from '@shared/components/ui/empty'
import { Box, Folder, Plus } from 'lucide-react'
import { Link, Outlet, useLoaderData, useLocation } from 'react-router'

import DashboardCard from '../../../components/dashboard/dashboard-cards'
import { ProjectContentSkeleton } from '../../../components/skeletons'
import { loadAuthenticatedUser } from '../../../lib/domain/auth/auth-loader.server'
import { getProject } from '../../../lib/domain/project/project-repository.server'
import {
	getRootSceneFolders,
	getRootScenes
} from '../../../lib/domain/scene/scene-folder-repository.server'

import { Route } from './+types/project'

export async function loader({ request, params }: Route.LoaderArgs) {
	const projectId = params.projectId

	if (!projectId) {
		throw new Response('Project ID is required', { status: 400 })
	}

	// Auth check (reads from session, very cheap)
	const { user, userWithDefaults } = await loadAuthenticatedUser(request)

	// Fetch project data
	const project = await getProject(projectId, user.id)

	if (!project) {
		throw new Response('Project not found', { status: 404 })
	}

	// Fetch root folders and root scenes in parallel
	const [folders, scenes] = await Promise.all([
		getRootSceneFolders(projectId, user.id),
		getRootScenes(projectId, user.id)
	])

	return {
		user,
		userWithDefaults,
		project,
		folders,
		scenes
	}
}

export function HydrateFallback() {
	return <ProjectContentSkeleton />
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../../components/errors'

const EmptyProjectContentState = () => (
	<Empty>
		<EmptyHeader>No content yet</EmptyHeader>
		<EmptyDescription>
			Start by creating your first scene or folder.
		</EmptyDescription>
		<EmptyContent>
			<div className="flex justify-center gap-3">
				<Button variant="outline">
					<Plus className="mr-2 h-4 w-4" />
					Create Folder
				</Button>

				<Link viewTransition to="/publisher">
					<Button>
						<Plus className="mr-2 h-4 w-4" />
						Create Scene
					</Button>
				</Link>
			</div>
		</EmptyContent>
	</Empty>
)

const ProjectPage = () => {
	const location = useLocation()
	const { project, folders, scenes } = useLoaderData<typeof loader>()
	const projectId = project.id

	const projectContent = {
		folders,
		scenes
	}

	// Check if we're at a child route (folder or scene)
	// If so, only show the outlet content
	const isProjectDetailRoute =
		location.pathname === `/dashboard/projects/${projectId}`

	if (!isProjectDetailRoute) {
		return <Outlet />
	}

	return (
		<div className="space-y-6 p-6">
			{projectContent.folders.length > 0 || projectContent.scenes.length > 0 ? (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{/* Folders */}
					{projectContent.folders.map((folder) => (
						<DashboardCard
							key={folder.id}
							title={folder.name}
							icon={<Folder className="h-5 w-5" />}
							description={folder.description || 'No description'}
							linkTo={`/dashboard/projects/${projectId}/folder/${folder.id}`}
							id={folder.id}
							navigationState={{
								name: folder.name,
								description: folder.description || undefined,
								projectName: project.name,
								type: 'folder' as const
							}}
						/>
					))}

					{/* Scenes */}
					{projectContent.scenes.map((scene) => (
						<DashboardCard
							key={scene.id}
							title={scene.name}
							description={scene.description || 'No description'}
							linkTo={`/dashboard/projects/${projectId}/${scene.id}`}
							icon={<Box className="h-5 w-5" />}
							id={scene.id}
							navigationState={{
								name: scene.name,
								description: scene.description || undefined,
								projectName: project.name,
								type: 'scene' as const
							}}
						>
							<div className="flex items-center gap-2">
								<Badge variant="secondary">{scene.status}</Badge>
								{scene.thumbnailUrl && (
									<Badge variant="outline">Has Thumbnail</Badge>
								)}
							</div>
						</DashboardCard>
					))}
				</div>
			) : (
				<EmptyProjectContentState />
			)}
		</div>
	)
}

export default ProjectPage
