import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { CardContent, CardFooter, CardHeader } from '@shared/components/ui/card'
import { cn } from '@shared/utils'
import {
	ModelFile,
	SceneLoadResult,
	useLoadModel
} from '@vctrl/hooks/use-load-model'
import { useSetAtom } from 'jotai/react'
import { Eye, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLoaderData } from 'react-router'

import { Route } from './+types/scene'
import CenteredSpinner from '../../../components/centered-spinner'
import BasicCard from '../../../components/layout-components/basic-card'
import { ClientVectrealViewer } from '../../../components/viewer/client-vectreal-viewer'
import { loadAuthenticatedUser } from '../../../lib/domain/auth/auth-loader.server'
import { getProject } from '../../../lib/domain/project/project-repository.server'
import {
	getScene,
	getSceneFolderAncestry
} from '../../../lib/domain/scene/scene-folder-repository.server'
import { deleteDialogAtom } from '../../../lib/stores/dashboard-management-store'

export async function loader({ request, params }: Route.LoaderArgs) {
	const projectId = params.projectId
	const sceneId = params.sceneId

	if (!projectId || !sceneId) {
		throw new Response('Project ID and Scene ID are required', { status: 400 })
	}

	// Auth check (reads from session, very cheap)
	const { user, userWithDefaults } = await loadAuthenticatedUser(request)

	// Fetch project and scene data
	const [project, scene] = await Promise.all([
		getProject(projectId, user.id),
		getScene(sceneId, user.id)
	])

	if (!project) {
		throw new Response('Project not found', { status: 404 })
	}

	if (!scene) {
		throw new Response('Scene not found', { status: 404 })
	}

	const folderPath = scene.folderId
		? await getSceneFolderAncestry(scene.folderId, user.id)
		: []

	return {
		user,
		userWithDefaults,
		project,
		scene,
		folderPath
	}
}

export function HydrateFallback() {
	return <CenteredSpinner text="Loading scene..." />
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../../components/errors'

interface PreviewModelProps {
	file: ModelFile | null
	sceneData?: SceneLoadResult
}

const inFlightSceneSettingsRequests = new Map<
	string,
	Promise<SceneLoadResult>
>()

const PreviewModel = memo(({ file, sceneData }: PreviewModelProps) => {
	const height = 'h-[80vh]'

	return (
		<div className={cn('relative', height)}>
			<div className="h-full">
				<ClientVectrealViewer
					model={file?.model}
					envOptions={sceneData?.settings?.environment}
					controlsOptions={sceneData?.settings?.controls}
					shadowsOptions={sceneData?.settings?.shadows}
					loader={<CenteredSpinner text="Preparing scene..." />}
					fallback={<CenteredSpinner text="Loading scene..." />}
				/>
			</div>
			<div className="from-background absolute bottom-0 h-1/4 w-full bg-gradient-to-t to-transparent" />
		</div>
	)
})

const ScenePage = () => {
	const { scene } = useLoaderData<typeof loader>()
	const sceneId = scene.id
	const setDeleteDialog = useSetAtom(deleteDialogAtom)

	// Use sceneId as key to create a new hook instance per scene
	const { file, loadFromServer } = useLoadModel()

	const [isLoadingScene, setIsLoadingScene] = useState(false)
	const [sceneData, setSceneData] = useState<SceneLoadResult>()
	const isMountedRef = useRef(true)
	const activeSceneIdRef = useRef<string | null>(sceneId)

	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
		}
	}, [])

	useEffect(() => {
		activeSceneIdRef.current = sceneId
	}, [sceneId])

	function handleDeleteClick() {
		setDeleteDialog({
			open: true,
			items: [
				{
					id: scene.id,
					type: 'scene',
					name: scene.name,
					projectId: scene.projectId,
					folderId: scene.folderId
				}
			]
		})
	}

	const getSceneSettings = useCallback(async () => {
		try {
			if (!sceneId) return

			if (sceneData?.sceneId === sceneId) {
				return
			}

			setIsLoadingScene(true)

			const existingRequest = inFlightSceneSettingsRequests.get(sceneId)
			const request =
				existingRequest ??
				loadFromServer({
					sceneId,
					serverOptions: {
						endpoint: `/api/scenes/${sceneId}`
					}
				})

			if (!existingRequest) {
				inFlightSceneSettingsRequests.set(
					sceneId,
					request.finally(() => {
						inFlightSceneSettingsRequests.delete(sceneId)
					})
				)
			}

			const loadedSceneData = await request

			if (!isMountedRef.current || activeSceneIdRef.current !== sceneId) {
				return
			}

			setSceneData(loadedSceneData)
		} catch (error) {
			console.error('Failed to load scene:', error)
			if (isMountedRef.current && activeSceneIdRef.current === sceneId) {
				setIsLoadingScene(false)
			}
		}
	}, [loadFromServer, sceneData?.sceneId, sceneId])

	useEffect(() => {
		if (sceneId && (!sceneData || sceneData.sceneId !== sceneId)) {
			getSceneSettings()
		}
	}, [getSceneSettings, sceneData, sceneId])

	// Stop loading state once file is actually loaded
	useEffect(() => {
		if (file?.model && isLoadingScene) {
			setIsLoadingScene(false)
		}
	}, [file, isLoadingScene])

	return (
		<>
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
