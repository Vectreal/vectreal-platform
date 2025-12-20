import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { File, Folder, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router'

import DashboardCard from '../../../components/dashboard/dashboard-card'
import { useFolderContent, useProject, useSceneFolder } from '../../../hooks'

const FolderPage = () => {
	const params = useParams()
	const projectId = params.projectId
	const folderId = params.folderId

	const project = useProject(projectId || '')
	const folder = useSceneFolder(folderId || '')
	const folderContent = useFolderContent(folderId || '')

	if (!folder || !project || !projectId || !folderId) {
		return (
			<div className="p-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-gray-900">Folder Not Found</h1>
					<p className="mt-2 text-gray-600">
						The folder you're looking for doesn't exist or you don't have access
						to it.
					</p>
					<Link viewTransition to={`/dashboard/projects/${projectId}`}>
						<Button className="mt-4">Back to Project</Button>
					</Link>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-6 p-6">
			{folderContent &&
			(folderContent.subfolders.length > 0 ||
				folderContent.scenes.length > 0) ? (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{/* Subfolders */}
					{folderContent.subfolders.map((subfolder) => (
						<DashboardCard
							key={subfolder.id}
							title={subfolder.name}
							description={subfolder.description || 'No description'}
							linkTo={`/dashboard/projects/${projectId}/folder/${subfolder.id}`}
							icon={<Folder className="h-5 w-5 text-blue-500" />}
							id={subfolder.id}
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
						Empty folder
					</h3>
					<p className="mt-1 text-gray-500">
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
