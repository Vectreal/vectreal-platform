import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { CheckCircle, File, FolderOpen, Plus } from 'lucide-react'
import { Link } from 'react-router'

import DashboardCard from '../../components/dashboard/dashboard-card'
import StatCard from '../../components/dashboard/stat-card'
import {
	useOrganizations,
	useProjectStats,
	useRecentProjects,
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
	const recentProjects = useRecentProjects(6)

	const stats = [
		{
			icon: FolderOpen,
			value: projectStats.total,
			label: 'Projects'
		},
		{
			icon: File,
			value: sceneStats.total,
			label: 'Scenes'
		},
		{
			icon: CheckCircle,
			value: sceneStats.byStatus.published || 0,
			label: 'Published'
		}
	]

	return (
		<div className="space-y-8 p-6">
			{/* Statistics Overview */}
			<div className="flex max-w-lg justify-between gap-4">
				{stats.map((stat) => (
					<StatCard
						key={stat.label}
						icon={stat.icon}
						value={stat.value}
						label={stat.label}
					/>
				))}
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
								icon={<File className="text-primary h-5 w-5" />}
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

			{/* Recent Projects */}
			{recentProjects.length > 0 && (
				<div>
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-xl font-semibold">Recent Projects</h2>
						<Link viewTransition to="/dashboard/projects">
							<Button variant="outline" size="sm">
								View All
							</Button>
						</Link>
					</div>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{recentProjects.map(({ project, organizationId }) => (
							<DashboardCard
								key={project.id}
								title={project.name}
								description={
									organizations.find(
										({ organization }) => organization.id === organizationId
									)?.organization.name || 'Unknown Organization'
								}
								linkTo={`/dashboard/projects/${project.id}`}
								icon={<FolderOpen className="text-primary h-5 w-5" />}
								id={project.id}
							></DashboardCard>
						))}
					</div>
				</div>
			)}

			{/* Empty State */}
			{!projectStats.total && (
				<div className="p-8 text-center">
					<FolderOpen className="text-primary/60 mx-auto h-12 w-12" />
					<h3 className="text-primary mt-2 text-lg font-medium">
						Welcome to Vectreal
					</h3>
					<p className="text-primary/70">
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
