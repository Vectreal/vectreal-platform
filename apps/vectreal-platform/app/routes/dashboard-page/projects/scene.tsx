import { Button } from '@vctrl-ui/ui/button'
import { CardContent, CardHeader } from '@vctrl-ui/ui/card'
import { Edit, Eye, Settings } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { BasicCard } from '../../../components'
import { useProject, useScene } from '../../../hooks'

const ScenePage = () => {
	const params = useParams()
	const projectId = params.projectId
	const sceneId = params.sceneId

	const project = useProject(projectId || '')
	const scene = useScene(sceneId || '')

	if (!scene || !project || !projectId || !sceneId) {
		return (
			<div className="p-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-gray-900">Scene Not Found</h1>
					<p className="mt-2 text-gray-600">
						The scene you're looking for doesn't exist or you don't have access
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
		<div className="p-6">
			{/* Scene Details */}
			<div className="grid gap-6 md:grid-cols-3">
				{/* Main Content Area */}
				<div className="md:col-span-2">
					<BasicCard>
						<CardHeader>
							<h2 className="mb-4 text-xl font-semibold">Scene Preview</h2>
						</CardHeader>
						<CardContent className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border">
							{scene.scene.thumbnailUrl ? (
								<img
									src={scene.scene.thumbnailUrl}
									alt={scene.scene.name}
									className="h-full w-full object-cover"
								/>
							) : (
								<div className="text-center">
									<Eye className="mx-auto h-12 w-12 text-gray-400" />
									<p className="mt-2 text-sm text-gray-500">
										No preview available
									</p>
								</div>
							)}
						</CardContent>
					</BasicCard>
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Scene Info */}
					<BasicCard>
						<CardHeader>
							<h3 className="mb-3 font-semibold">Scene Information</h3>
						</CardHeader>
						<CardContent className="space-y-2 text-sm">
							<div>
								<span className="text-gray-600">ID:</span>
								<code className="ml-2 text-xs">
									{scene.scene.id.slice(0, 8)}...
								</code>
							</div>
							<div>
								<span className="text-gray-600">Status:</span>
								<span className="ml-2">{scene.scene.status}</span>
							</div>
							<div>
								<span className="text-gray-600">Created:</span>
								<span className="ml-2">
									{new Date(scene.scene.createdAt).toLocaleDateString()}
								</span>
							</div>
							<div>
								<span className="text-gray-600">Modified:</span>
								<span className="ml-2">
									{new Date(scene.scene.updatedAt).toLocaleDateString()}
								</span>
							</div>
						</CardContent>
					</BasicCard>

					{/* Actions */}
					<BasicCard>
						<CardHeader>
							<h3 className="mb-3 font-semibold">Quick Actions</h3>
						</CardHeader>
						<CardContent className="space-y-2">
							<Button variant="outline" className="w-full justify-start">
								<Eye className="mr-2 h-4 w-4" />
								Open in Viewer
							</Button>
							<Button variant="outline" className="w-full justify-start">
								<Edit className="mr-2 h-4 w-4" />
								Open Editor
							</Button>
							<Button variant="outline" className="w-full justify-start">
								<Settings className="mr-2 h-4 w-4" />
								Scene Settings
							</Button>
						</CardContent>
					</BasicCard>
				</div>
			</div>
		</div>
	)
}

export default ScenePage
