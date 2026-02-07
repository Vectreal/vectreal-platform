import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { File, Folder, Plus } from 'lucide-react'
import { useLoaderData } from 'react-router'

import DashboardCard from '../../../components/dashboard/dashboard-cards'
import { FolderContentSkeleton } from '../../../components/skeletons'
import { loadAuthenticatedUser } from '../../../lib/loaders/auth-loader.server'
import { projectService } from '../../../lib/services/project-service.server'
import { sceneFolderService } from '../../../lib/services/scene-folder-service.server'

import { Route } from './+types/folder'

export async function loader({ request, params }: Route.LoaderArgs) {
	const projectId = params.projectId
	const folderId = params.folderId

	if (!projectId || !folderId) {
		throw new Response('Project ID and Folder ID are required', { status: 400 })
	}

	// Auth check (reads from session, very cheap)
	const { user, userWithDefaults } = await loadAuthenticatedUser(request)

	// Fetch project and folder data
	const [project, folder] = await Promise.all([
		projectService.getProject(projectId, user.id),
		sceneFolderService.getSceneFolder(folderId, user.id)
	])

	if (!project) {
		throw new Response('Project not found', { status: 404 })
	}

	if (!folder) {
		throw new Response('Folder not found', { status: 404 })
	}

	// Fetch subfolders and scenes in parallel
	const [subfolders, scenes] = await Promise.all([
		sceneFolderService.getChildFolders(folderId, user.id),
		sceneFolderService.getFolderScenes(folderId, user.id)
	])

	return {
		user,
		userWithDefaults,
		project,
		folder,
		subfolders,
		scenes
	}
}

export function HydrateFallback() {
	return <FolderContentSkeleton />
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../../components/errors'

const FolderPage = () => {
	const { project, subfolders, scenes } = useLoaderData<typeof loader>()
	const projectId = project.id

	const folderContent = {
		subfolders,
		scenes
	}

	return (
		<div className="space-y-6 p-6">
			{folderContent.subfolders.length > 0 ||
			folderContent.scenes.length > 0 ? (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{/* Subfolders */}
					{folderContent.subfolders.map((subfolder) => (
						<DashboardCard
							key={subfolder.id}
							title={subfolder.name}
							description={subfolder.description || 'No description'}
							linkTo={`/dashboard/projects/${projectId}/folder/${subfolder.id}`}
							icon={<Folder className="h-5 w-5" />}
							id={subfolder.id}
							navigationState={{
								name: subfolder.name,
								description: subfolder.description || undefined,
								projectName: project.name,
								type: 'folder' as const
							}}
						>
							<div className="flex items-center gap-2">
								<Badge variant="secondary">Folder</Badge>
							</div>
						</DashboardCard>
					))}

					{/* Scenes in Folder */}
					{folderContent.scenes.map((scene) => (
						<DashboardCard
							key={scene.id}
							title={scene.name}
							description={scene.description || 'No description'}
							linkTo={`/dashboard/projects/${projectId}/${scene.id}`}
							icon={<File className="h-5 w-5 text-green-500" />}
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
				<div className="p-8 text-center">
					<Folder className="text-primary/60 mx-auto h-12 w-12" />
					<h3 className="text-primary mt-2 text-lg font-medium">
						Empty folder
					</h3>
					<p className="text-primary/70 mt-1">
						Add subfolders or scenes to organize your content.
					</p>
					<div className="mt-6 flex justify-center gap-3">
						<Button variant="outline">
							<Plus className="mr-2 h-4 w-4" />
							Create Subfolder
						</Button>
						<Button>
							<Plus className="mr-2 h-4 w-4" />
							Create Scene
						</Button>
					</div>
				</div>
			)}
		</div>
	)
}

export default FolderPage
