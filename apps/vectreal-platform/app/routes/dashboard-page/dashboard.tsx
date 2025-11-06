import { Badge } from '@vctrl-ui/ui/badge'
import { Button } from '@vctrl-ui/ui/button'
import { CheckCircle, File, Folder, FolderOpen, Plus } from 'lucide-react'
import { Link } from 'react-router'

import DashboardCard from '../../components/dashboard/dashboard-card'
import {
	useOrganizations,
	useProjectStats,
	useRecentScenes,
	useSceneStats
} from '../../hooks'

import { Route } from './+types/dashboard'

export async function loader({ request }: Route.LoaderArgs) {
	return null
}

const DashboardPage = () => {
	const organizations = useOrganizations()
	const projectStats = useProjectStats()
	const sceneStats = useSceneStats()
	const recentScenes = useRecentScenes(6)

	return (
		<div className="space-y-8 p-6">
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
				{/* Statistics Overview */}
				<div className="p-6">
					<div className="flex items-center-safe">
						<div className="flex-shrink-0">
							<FolderOpen className="h-8 w-8 text-blue-500" />
						</div>
						<div className="ml-4">
							<div className="text-primary text-2xl font-bold">
								{projectStats.total}
							</div>
							<div className="text-muted-forground text-sm">Projects</div>
						</div>
					</div>
				</div>

				<div className="p-6">
					<div className="flex items-center-safe">
						<div className="flex-shrink-0">
							<File className="h-8 w-8 text-green-500" />
						</div>
						<div className="ml-4">
							<div className="text-primary text-2xl font-bold">
								{sceneStats.total}
							</div>
							<div className="text-muted-forground text-sm">Scenes</div>
						</div>
					</div>
				</div>

				<div className="p-6">
					<div className="flex items-center-safe">
						<div className="flex-shrink-0">
							<Folder className="h-8 w-8 text-purple-500" />
						</div>
						<div className="ml-4">
							<div className="text-primary text-2xl font-bold">
								{organizations.length}
							</div>
							<div className="text-muted-forground text-sm">Organizations</div>
						</div>
					</div>
				</div>

				<div className="p-6">
					<div className="flex items-center-safe">
						<div className="flex-shrink-0">
							<CheckCircle className="h-8 w-8 text-orange-500" />
						</div>
						<div className="ml-4">
							<div className="text-primary text-2xl font-bold">
								{sceneStats.byStatus.published || 0}
							</div>
							<div className="text-muted-forground text-sm">Published</div>
						</div>
					</div>
				</div>
			</div>

			{/* Recent Scenes */}
			{recentScenes.length > 0 && (
				<div>
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-xl font-semibold">Recent Scenes</h2>
						<Link viewTransition to="/dashboard/projects">
							<Button variant="outline" size="sm">
								View All
							</Button>
						</Link>
					</div>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{recentScenes.map((scene) => (
							<DashboardCard
								key={scene.id}
								title={scene.name}
								description={scene.description || 'No description'}
								linkTo={`/dashboard/projects/${scene.projectId}/${scene.id}`}
								icon={<File className="h-5 w-5 text-green-500" />}
								id={scene.id}
							>
								<div className="flex items-center gap-2">
									<Badge variant="secondary">{scene.status}</Badge>
									{scene.thumbnailUrl && (
										<Badge variant="outline">Thumbnail</Badge>
									)}
								</div>
							</DashboardCard>
						))}
					</div>
				</div>
			)}

			{/* Empty State */}
			{projectStats.total === 0 && (
				<div className="rounded-lg border border-gray-200 p-8 text-center">
					<FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
					<h3 className="mt-2 text-lg font-medium text-gray-900">
						Welcome to Vectreal
					</h3>
					<p className="mt-1 text-gray-500">
						Get started by creating your first project.
					</p>
					<Link viewTransition to="/dashboard/projects/new">
						<Button className="mt-4">
							<Plus className="mr-2 h-4 w-4" />
							Create Your First Project
						</Button>
					</Link>
				</div>
			)}
		</div>
	)
}

export default DashboardPage
