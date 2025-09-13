import { Badge } from '@vctrl-ui/ui/badge'

import { Button } from '@vctrl-ui/ui/button'
import { File, Folder, Plus } from 'lucide-react'
import { Link, Outlet, useLocation, useParams } from 'react-router'

import DashboardCard from '../../../components/dashboard/dashboard-card'
import {
	useUserSceneFolders,
	useUserScenes
} from '../../../contexts/auth-context'
import { useProject, useProjectContent } from '../../../hooks'

const ProjectPage = () => {
	const params = useParams()
	const location = useLocation()
	const projectId = params.projectId

	const project = useProject(projectId || '')
	const scenes = useUserScenes()
	const sceneFolders = useUserSceneFolders()

	const projectContent = useProjectContent(
		projectId || '',
		sceneFolders,
		scenes
	)

	if (!project || !projectId) {
		return (
			<div className="p-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-gray-900">
						Project Not Found
					</h1>
					<p className="mt-2 text-gray-600">
						The project you're looking for doesn't exist or you don't have
						access to it.
					</p>
					<Link viewTransition to="/dashboard/projects">
						<Button className="mt-4">Back to Projects</Button>
					</Link>
				</div>
			</div>
		)
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
					{projectContent.folders.map(({ folder }) => (
						<DashboardCard
							key={folder.id}
							title={folder.name}
							description={folder.description || 'No description'}
							linkTo={`/dashboard/projects/${projectId}/folder/${folder.id}`}
							icon={<Folder className="h-5 w-5 text-blue-500" />}
							id={folder.id}
						>
							<div className="flex items-center gap-2">
								<Badge variant="secondary">Folder</Badge>
							</div>
						</DashboardCard>
					))}

					{/* Root Scenes */}
					{projectContent.scenes.map(({ scene }) => (
						<DashboardCard
							key={scene.id}
							title={scene.name}
							description={scene.description || 'No description'}
							linkTo={`/dashboard/projects/${projectId}/${scene.id}`}
							icon={<File className="h-5 w-5 text-green-500" />}
							id={scene.id}
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
				<div className="rounded-lg border border-gray-200 p-8 text-center">
					<Folder className="mx-auto h-12 w-12 text-gray-400" />
					<h3 className="mt-2 text-lg font-medium text-gray-900">
						No content yet
					</h3>
					<p className="mt-1 text-gray-500">
						Start by creating your first scene or folder.
					</p>
					<div className="mt-6 flex justify-center gap-3">
						<Button variant="outline">
							<Plus className="mr-2 h-4 w-4" />
							Create Folder
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

export default ProjectPage
