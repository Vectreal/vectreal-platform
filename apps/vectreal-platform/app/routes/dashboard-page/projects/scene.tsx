import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { CardContent, CardFooter, CardHeader } from '@shared/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogTitle
} from '@shared/components/ui/dialog'
import { cn } from '@shared/utils'
import {
	ModelFile,
	SceneLoadResult,
	useLoadModel
} from '@vctrl/hooks/use-load-model'
import { VectrealViewer } from '@vctrl/viewer'
import { Eye, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useState } from 'react'
import { Link, useFetcher, useParams } from 'react-router'

import { BasicCard } from '../../../components'
import { useProject, useScene } from '../../../hooks'

interface ConfirmDeleteModalProps {
	isOpen: boolean
	onClose: () => void
	onConfirm: () => void
}

const ConfirmDeleteModal = ({
	isOpen,
	onClose,
	onConfirm
}: ConfirmDeleteModalProps) => {
	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogOverlay />
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Confirm Delete Scene</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete this scene? This action cannot be
						undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={() => {
							onConfirm()
							onClose()
						}}
					>
						Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

interface PreviewModelProps {
	file: ModelFile | null
	sceneData?: SceneLoadResult
}

const PreviewModel = memo(({ file, sceneData }: PreviewModelProps) => {
	const height = 'h-[80vh]'

	return (
		<div className={cn('relative', height)}>
			<div className="h-full">
				<VectrealViewer
					model={file?.model}
					envOptions={sceneData?.settings?.environment}
					controlsOptions={sceneData?.settings?.controls}
					shadowsOptions={sceneData?.settings?.shadows}
					loader={
						<div className="text-center">
							<div className="mb-4 text-lg font-medium">Loading scene...</div>
							<div className="text-primary/70 text-sm">
								Please wait while we fetch your 3D model
							</div>
						</div>
					}
				/>
			</div>
			<div className="from-background absolute bottom-0 h-1/4 w-full bg-gradient-to-t to-transparent" />
		</div>
	)
})

const ScenePage = () => {
	const { submit } = useFetcher()

	const params = useParams()
	const projectId = params.projectId
	const sceneId = params.sceneId

	// Use sceneId as key to create a new hook instance per scene
	const { file, loadFromServer } = useLoadModel()

	const project = useProject(projectId || '')
	const scene = useScene(sceneId || '')

	const [isLoadingScene, setIsLoadingScene] = useState(false)
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const [sceneData, setSceneData] = useState<SceneLoadResult>()

	function handleDeleteClick() {
		setShowDeleteConfirm(true)
	}

	const getSceneSettings = useCallback(async () => {
		try {
			if (!sceneId) return

			setIsLoadingScene(true)

			const sceneData = await loadFromServer({
				sceneId,
				serverOptions: {
					endpoint: '/api/scene-settings'
				}
			})

			setSceneData(sceneData)
		} catch (error) {
			console.error('Failed to load scene:', error)
			setIsLoadingScene(false)
		}
	}, [loadFromServer, sceneId])

	useEffect(() => {
		if (sceneId && (!sceneData || sceneData.sceneId !== sceneId)) {
			getSceneSettings()
		}
	}, [getSceneSettings, sceneData, sceneId])

	async function handleConfirmDelete() {
		await submit(
			{ action: 'delete' },
			{
				method: 'post',
				action: `/api/dashboard/scene-actions/${sceneId}`
			}
		)
		// Future: implement delete logic
		setShowDeleteConfirm(false)
	}
	// Stop loading state once file is actually loaded
	useEffect(() => {
		if (file?.model && isLoadingScene) {
			setIsLoadingScene(false)
		}
	}, [file, isLoadingScene])

	if (!scene || !project || !projectId || !sceneId) {
		return (
			<div className="p-6">
				<div className="text-center">
					<h1 className="text-primary text-2xl font-bold">Scene Not Found</h1>
					<p className="text-primary/70 mt-2">
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
		<>
			<ConfirmDeleteModal
				isOpen={showDeleteConfirm}
				onClose={() => setShowDeleteConfirm(false)}
				onConfirm={handleConfirmDelete}
			/>

			<div className="relative h-full">
				<PreviewModel file={file} sceneData={sceneData} />

				{/* Scene Details */}
				<div className="absolute bottom-0 left-1/2 w-full max-w-3xl -translate-x-1/2 p-4">
					{/* Scene Info */}
					<BasicCard>
						<CardHeader>
							<span className="flex items-start justify-between">
								<h3 className="grow truncate font-semibold">{scene.name}</h3>
								<Badge>{scene.status}</Badge>
							</span>
							<code className="text-muted-foreground text-xs">{scene.id}</code>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-2">
								<div>
									<p className="text-muted-foreground mb-2">Description</p>
									<p>{scene.description || 'No description provided.'}</p>
								</div>
								<div className="space-y-2">
									<Link
										className="block"
										viewTransition
										to={`/publisher/${scene.id}`}
									>
										<Button variant="outline" className="w-full justify-start">
											<Eye className="mr-2 h-4 w-4" />
											Open in Publisher
										</Button>
									</Link>

									<Button
										onClick={handleDeleteClick}
										variant="outline"
										className="w-full justify-start text-red-600 hover:text-red-700"
									>
										<Trash2 className="mr-2 h-4 w-4" />
										Delete Scene
									</Button>
								</div>
							</div>
						</CardContent>

						<CardFooter className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
							<div>
								<span className="opacity-75">Created:</span>
								<span className="ml-2">
									{new Date(scene.createdAt).toLocaleDateString()}
								</span>
							</div>
							<div>
								<span className="opacity-75">Modified:</span>
								<span className="ml-2">
									{new Date(scene.updatedAt).toLocaleDateString()}
								</span>
							</div>
						</CardFooter>
					</BasicCard>
				</div>
			</div>
		</>
	)
}

export default ScenePage
