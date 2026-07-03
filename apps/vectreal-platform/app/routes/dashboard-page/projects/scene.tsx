import { Separator } from '@shared/components'
import {
	Avatar,
	AvatarFallback,
	AvatarImage
} from '@shared/components/ui/avatar'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { ButtonGroup } from '@shared/components/ui/button-group'
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle
} from '@shared/components/ui/drawer'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@shared/components/ui/dropdown-menu'
import { cn } from '@shared/utils'
import {
	ModelFile,
	SceneLoadResult,
	useLoadModel
} from '@vctrl/hooks/use-load-model'
import { AnimatePresence, motion } from 'framer-motion'
import { useSetAtom } from 'jotai/react'
import {
	ChevronDown,
	ChevronRight,
	Cloud,
	ExternalLink,
	Info,
	LayoutDashboard,
	Radio,
	Rocket,
	Trash2,
	X
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { data, Link, useNavigate } from 'react-router'

import { Route } from './+types/scene'
import CenteredSpinner from '../../../components/centered-spinner'
import {
	buildAssetListItemProps,
	InlineEditableMetadataField,
	SceneAssetListItem
} from '../../../components/dashboard'
import { EmbedOptionsPanel } from '../../../components/embed/embed-options-panel'
import { ScenePublishStateControl } from '../../../components/publishing/scene-publish-state-control'
import { ClientVectrealViewer } from '../../../components/viewer/client-vectreal-viewer'
import { useDashboardSceneActions } from '../../../hooks/use-dashboard-scene-actions'
import { loadAuthenticatedSession } from '../../../lib/domain/auth/auth-loader.server'
import { buildFullscreenPreviewPath } from '../../../lib/domain/embed/embed-snippet'
import { getProject } from '../../../lib/domain/project/project-repository.server'
import { resolveBakedShadowSource } from '../../../lib/domain/scene/client/baked-shadow-source'
import { loadSceneFromApi } from '../../../lib/domain/scene/client/load-scene-from-api.client'
import { getDashboardSceneLoadErrorMessage } from '../../../lib/domain/scene/scene-load-error-messages'
import {
	getScene,
	getSceneFolderAncestry
} from '../../../lib/domain/scene/server/scene-folder-repository.server'
import { getPublishedScenePreview } from '../../../lib/domain/scene/server/scene-preview-repository.server'
import { sceneSettingsService } from '../../../lib/domain/scene/server/scene-settings-service.server'
import { shouldRevalidateForRouteParams } from '../../../lib/navigation/dashboard-route-behavior'
import { deleteDialogAtom } from '../../../lib/stores/dashboard-management-store'
import { toViewerLoadingThumbnail } from '../../../lib/viewer/viewer-loading-thumbnail'

import type {
	SceneAdditionalMetrics,
	SerializedSceneAssetDataMap
} from '../../../types/api'
import type { ShouldRevalidateFunction } from 'react-router'

export type SceneAssetSummary = {
	id: string
	name: string
	type: string
	fileSize: number | null
	mimeType: string | null
}

type SceneDetailsSummary = {
	fileSizeBytes: number | null
	assetCount: number
	textureBytes: number | null
	textureCount: number | null
	meshesCount: number | null
	verticesCount: number | null
	assets: SceneAssetSummary[]
}

function formatBytes(bytes: number | null | undefined): string {
	if (bytes == null || Number.isNaN(bytes)) {
		return '-'
	}

	if (bytes === 0) {
		return '0 B'
	}

	const units = ['B', 'KB', 'MB', 'GB']
	const index = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		units.length - 1
	)
	const size = bytes / 1024 ** index
	return `${size >= 100 ? Math.round(size) : size.toFixed(size < 10 ? 1 : 0)} ${units[index]}`
}

export async function loader({ request, params }: Route.LoaderArgs) {
	const projectId = params.projectId
	const sceneId = params.sceneId

	if (!projectId || !sceneId) {
		throw new Response('Project ID and Scene ID are required', { status: 400 })
	}

	const { user, headers } = await loadAuthenticatedSession(request)

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

	const [folderPath, stats, sceneAssets] = await Promise.all([
		scene.folderId
			? getSceneFolderAncestry(scene.folderId, user.id)
			: Promise.resolve([]),
		sceneSettingsService.getSceneStats(sceneId).catch(() => null),
		sceneSettingsService.getSceneAssetRecords(sceneId)
	])

	const publishedMeta = await getPublishedScenePreview(projectId, sceneId)

	const additionalMetrics =
		stats?.additionalMetrics as SceneAdditionalMetrics | null | undefined

	const sceneDetails: SceneDetailsSummary = {
		fileSizeBytes:
			stats?.currentSceneBytes ?? stats?.initialSceneBytes ?? null,
		assetCount: sceneAssets.length,
		textureBytes:
			additionalMetrics?.currentTextureBytes ??
			additionalMetrics?.initialTextureBytes ??
			null,
		textureCount:
			stats?.optimized?.texturesCount ?? stats?.baseline?.texturesCount ?? null,
		meshesCount:
			stats?.optimized?.meshesCount ?? stats?.baseline?.meshesCount ?? null,
		verticesCount:
			stats?.optimized?.verticesCount ??
			stats?.baseline?.verticesCount ??
			null,
		assets: sceneAssets.map((asset) => ({
			id: asset.id,
			name: asset.name,
			type: asset.type,
			fileSize: asset.fileSize ?? null,
			mimeType: asset.mimeType ?? null
		}))
	}

	return data(
		{
			user,
			project,
			scene,
			publishState: {
				sceneId: scene.id,
				status: publishedMeta ? ('published' as const) : ('draft' as const),
				publishedAt: publishedMeta?.publishedAt?.toISOString() ?? null,
				publishedAssetId: publishedMeta?.publishedAssetId ?? null,
				publishedAssetSizeBytes: publishedMeta?.publishedAssetSizeBytes ?? null
			},
			folderPath,
			sceneDetails
		},
		{ headers }
	)
}

export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentParams,
	nextParams,
	formMethod,
	actionResult,
	defaultShouldRevalidate
}) => {
	return shouldRevalidateForRouteParams({
		currentParams,
		nextParams,
		paramKeys: ['projectId', 'sceneId'],
		formMethod,
		actionResult,
		defaultShouldRevalidate
	})
}

export function HydrateFallback() {
	return <CenteredSpinner text="Loading scene..." />
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../../components/errors'

interface PreviewModelProps {
	file: ModelFile | null
	sceneData?: SceneLoadResult
	thumbnailUrl?: string | null
}

const PreviewModel = memo(
	({ file, sceneData, thumbnailUrl }: PreviewModelProps) => {
		const loadingThumbnail = toViewerLoadingThumbnail(
			thumbnailUrl,
			'Scene thumbnail preview'
		)
		const bakedShadow = useMemo(
			() => resolveBakedShadowSource(sceneData?.shadows, sceneData?.assetData),
			[sceneData?.shadows, sceneData?.assetData]
		)

		return (
			<div className={cn('relative h-full')}>
				<ClientVectrealViewer
					cameraOptions={sceneData?.camera}
					model={file?.model}
					boundsOptions={sceneData?.bounds}
					envOptions={sceneData?.environment}
					controlsOptions={sceneData?.controls}
					normalizationOptions={sceneData?.normalization}
					shadowsOptions={sceneData?.shadows}
					staticShadowBake
					bakedShadow={bakedShadow}
					loadingThumbnail={loadingThumbnail}
					loader={<CenteredSpinner text="Preparing scene..." />}
					fallback={<CenteredSpinner text="Loading scene..." />}
				/>
			</div>
		)
	}
)

const ASSETS_COLLAPSED_LIMIT = 6

function DrawerAssetsSection({
	assets,
	assetData
}: {
	assets: SceneAssetSummary[]
	assetData?: SerializedSceneAssetDataMap | null
}) {
	const [expanded, setExpanded] = useState(false)
	const hasMore = assets.length > ASSETS_COLLAPSED_LIMIT
	const initial = assets.slice(0, ASSETS_COLLAPSED_LIMIT)
	const extra = assets.slice(ASSETS_COLLAPSED_LIMIT)

	return (
		<section className="space-y-3">
			<h3 className="text-sm font-semibold tracking-tight">Assets</h3>
			{assets.length === 0 ? (
				<p className="text-muted-foreground text-sm">No linked assets found.</p>
			) : (
				<div className="space-y-2">
					{initial.map((asset) => (
						<SceneAssetListItem
							key={asset.id}
							className="bg-muted/40"
							{...buildAssetListItemProps(asset, assetData)}
						/>
					))}

					<AnimatePresence initial={false}>
						{expanded && (
							<motion.div
								key="extra-assets"
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: 'auto' }}
								exit={{ opacity: 0, height: 0 }}
								transition={{ duration: 0.3, ease: 'easeInOut' }}
								className="space-y-2 overflow-hidden"
							>
								{extra.map((asset) => (
									<SceneAssetListItem
										key={asset.id}
										className="bg-muted/40"
										{...buildAssetListItemProps(asset, assetData)}
									/>
								))}
							</motion.div>
						)}
					</AnimatePresence>

					{hasMore && (
						<button
							type="button"
							onClick={() => setExpanded((prev) => !prev)}
							className="text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs transition-colors duration-200"
						>
							<motion.span
								animate={{ rotate: expanded ? 180 : 0 }}
								transition={{ duration: 0.25, ease: 'easeInOut' }}
								className="inline-flex"
							>
								<ChevronDown className="h-3.5 w-3.5" />
							</motion.span>
							{expanded
								? 'Show fewer'
								: `Show ${assets.length - ASSETS_COLLAPSED_LIMIT} more`}
						</button>
					)}
				</div>
			)}
		</section>
	)
}

const ScenePage = ({ loaderData }: Route.ComponentProps) => {
	const { scene, project, user, sceneDetails, publishState } = loaderData
	const sceneId = scene.id
	const navigate = useNavigate()
	const setDeleteDialog = useSetAtom(deleteDialogAtom)
	const { actionData, actionState } = useDashboardSceneActions()

	// Use sceneId as key to create a new hook instance per scene
	const { file, loadFromServer } = useLoadModel()

	const [isLoadingScene, setIsLoadingScene] = useState(false)
	const [sceneData, setSceneData] = useState<SceneLoadResult>()
	const [sceneLoadError, setSceneLoadError] = useState<string | null>(null)
	const [sceneState, setSceneState] = useState(scene)

	const [sceneNameDraft, setSceneNameDraft] = useState(scene.name)
	const [sceneDescriptionDraft, setSceneDescriptionDraft] = useState(
		scene.description || ''
	)
	const [isSavingMetadata, setIsSavingMetadata] = useState(false)
	const [metadataStatus, setMetadataStatus] = useState<
		'idle' | 'saved' | 'error'
	>('idle')
	const [drawerOpen, setDrawerOpen] = useState(false)
	const [copiedLink, setCopiedLink] = useState(false)

	const metadataResetTimerRef = useRef<number | null>(null)

	const fullscreenPreviewPath = buildFullscreenPreviewPath({
		projectId: project.id,
		sceneId: sceneState.id
	})
	const productPreviewPath = `/preview/product-detail/${project.id}/${sceneState.id}`
	const dashboardPath = `/dashboard/projects/${project.id}/${sceneState.id}`
	const sceneNameTrimmed = sceneNameDraft.trim()
	const sceneDescriptionCurrent = sceneState.description || ''
	const isTitleUnsaved =
		sceneNameTrimmed.length > 0 && sceneNameTrimmed !== sceneState.name
	const isDescriptionUnsaved = sceneDescriptionDraft !== sceneDescriptionCurrent
	const isMetadataUnsaved = isTitleUnsaved || isDescriptionUnsaved

	useEffect(() => {
		return () => {
			if (metadataResetTimerRef.current) {
				window.clearTimeout(metadataResetTimerRef.current)
			}
		}
	}, [])

	useEffect(() => {
		setSceneState(scene)
		setSceneNameDraft(scene.name)
		setSceneDescriptionDraft(scene.description || '')
		setMetadataStatus('idle')
	}, [scene])

	useEffect(() => {
		if (
			actionState !== 'idle' ||
			!actionData ||
			actionData.action !== 'delete'
		) {
			return
		}

		const deletedCurrentScene = actionData.results.some(
			(result) =>
				result.type === 'scene' && result.id === sceneId && result.success
		)

		if (!deletedCurrentScene) {
			return
		}

		navigate(`/dashboard/projects/${project.id}`, { replace: true })
	}, [actionData, actionState, navigate, project.id, sceneId])

	function handleDeleteClick() {
		setDeleteDialog({
			open: true,
			items: [
				{
					id: sceneState.id,
					type: 'scene',
					name: sceneState.name,
					projectId: sceneState.projectId,
					folderId: sceneState.folderId
				}
			]
		})
	}

	async function handleSaveMetadata() {
		const trimmedName = sceneNameTrimmed
		if (!trimmedName || isSavingMetadata) {
			return
		}

		const hasChanges =
			trimmedName !== sceneState.name ||
			sceneDescriptionDraft !== sceneDescriptionCurrent

		if (!hasChanges) {
			return
		}

		setIsSavingMetadata(true)
		setMetadataStatus('idle')

		try {
			const formData = new FormData()
			formData.append('action', 'update-scene-metadata')
			formData.append('name', trimmedName)
			formData.append('description', sceneDescriptionDraft)

			const response = await fetch(`/api/scenes/${sceneState.id}`, {
				method: 'POST',
				body: formData
			})

			const payload = await response.json()
			if (!response.ok || payload.error || !payload?.data?.scene) {
				throw new Error(payload?.error || 'Failed to update scene metadata')
			}

			const updatedScene = payload.data.scene as typeof scene
			setSceneState(updatedScene)
			setSceneNameDraft(updatedScene.name)
			setSceneDescriptionDraft(updatedScene.description || '')
			setMetadataStatus('saved')
		} catch (error) {
			console.error('Failed to update scene metadata:', error)
			setMetadataStatus('error')
		} finally {
			setIsSavingMetadata(false)
			if (metadataResetTimerRef.current) {
				window.clearTimeout(metadataResetTimerRef.current)
			}
			metadataResetTimerRef.current = window.setTimeout(() => {
				setMetadataStatus('idle')
			}, 2200)
		}
	}

	async function handleCopyDashboardLink() {
		if (!navigator?.clipboard) {
			return
		}

		const absoluteLink = new URL(
			dashboardPath,
			window.location.origin
		).toString()
		await navigator.clipboard.writeText(absoluteLink)
		setCopiedLink(true)
		window.setTimeout(() => setCopiedLink(false), 1500)
	}

	const openPublisherForPublishing = useCallback(() => {
		navigate(`/publisher/${sceneState.id}`)
	}, [navigate, sceneState.id])

	const retrySceneLoad = useCallback(() => {
		setSceneLoadError(null)
		setSceneData(undefined)
	}, [])

	useEffect(() => {
		if (!sceneId || sceneData?.sceneId === sceneId) {
			return
		}

		let cancelled = false

		const loadSceneSettings = async () => {
			try {
				setIsLoadingScene(true)
				setSceneLoadError(null)

				const loadedSceneData = await loadSceneFromApi({
					sceneId,
					endpoint: `/api/scenes/${sceneId}`,
					loadFromServer,
					parseMode: 'direct'
				})

				if (cancelled) {
					return
				}

				setSceneData(loadedSceneData)
			} catch (error) {
				console.error('Failed to load scene:', error)
				if (!cancelled) {
					setSceneLoadError(getDashboardSceneLoadErrorMessage(error))
					setIsLoadingScene(false)
				}
			}
		}

		void loadSceneSettings()

		return () => {
			cancelled = true
		}
	}, [loadFromServer, sceneData?.sceneId, sceneId])

	// Stop loading state once file is actually loaded
	useEffect(() => {
		if (file?.model && isLoadingScene) {
			setIsLoadingScene(false)
		}
	}, [file, isLoadingScene])

	return (
		<div className="h-[calc(100dvh-5rem)] overflow-hidden px-5 pt-1 pb-5 xl:px-6">
			{sceneState.thumbnailUrl ? (
				<link rel="preload" as="image" href={sceneState.thumbnailUrl} />
			) : null}
			<div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
				<main className="flex min-h-0 flex-col gap-4">
					{sceneLoadError && !file?.model ? (
						<section className="bg-muted/30 border-border space-y-3 rounded-2xl border p-5">
							<h2 className="text-base font-semibold">Unable to Load Scene</h2>
							<p className="text-muted-foreground text-sm">{sceneLoadError}</p>
							<div className="flex flex-wrap gap-2">
								<Button type="button" onClick={retrySceneLoad}>
									Retry
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={openPublisherForPublishing}
								>
									Open in Publisher
								</Button>
							</div>
						</section>
					) : null}
					<section className="relative min-h-64 flex-1 overflow-hidden rounded-2xl bg-black/2">
						<PreviewModel
							file={file}
							sceneData={sceneData}
							thumbnailUrl={sceneState.thumbnailUrl}
						/>
					</section>
					<section className="bg-muted/30 space-y-6 rounded-2xl px-4 py-4 sm:px-5">
						<header className="flex flex-col items-start gap-6 md:flex-row">
							<div className="grow space-y-2 max-md:w-full">
								<InlineEditableMetadataField
									ariaLabel="Scene title"
									value={sceneNameDraft}
									onChange={setSceneNameDraft}
									onCommit={handleSaveMetadata}
									titleStyle="title"
									placeholder="Scene Title"
									indicatorTitle="Scene title save status"
									isUnsaved={isTitleUnsaved}
									isSaving={isSavingMetadata && isMetadataUnsaved}
									isSaved={metadataStatus === 'saved' && !isTitleUnsaved}
								/>
								<InlineEditableMetadataField
									ariaLabel="Scene description"
									multiline
									value={sceneDescriptionDraft}
									onChange={setSceneDescriptionDraft}
									onCommit={handleSaveMetadata}
									placeholder="Scene Description"
									indicatorTitle="Scene description save status"
									isUnsaved={isDescriptionUnsaved}
									isSaving={isSavingMetadata && isMetadataUnsaved}
									isSaved={metadataStatus === 'saved' && !isDescriptionUnsaved}
								/>
							</div>
							<div className="flex flex-col gap-3 max-md:w-full xl:justify-end">
								<ButtonGroup className="w-full">
									<Button asChild className="w-full">
										<Link viewTransition to={fullscreenPreviewPath}>
											Preview
										</Link>
									</Button>

									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button size="icon">
												<ChevronDown className="h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent>
											<DropdownMenuItem asChild>
												<Link viewTransition to={fullscreenPreviewPath}>
													<LayoutDashboard className="mr-2 h-4 w-4" />
													Fullscreen Preview
												</Link>
											</DropdownMenuItem>

											<DropdownMenuItem asChild>
												<Link viewTransition to={productPreviewPath}>
													<ExternalLink className="mr-2 h-4 w-4" />
													Product Preview
												</Link>
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</ButtonGroup>

								<Button variant="secondary" asChild>
									<Link viewTransition to={`/publisher/${sceneState.id}`}>
										<Rocket className="mr-2 h-4 w-4" />
										Open in Publisher
									</Link>
								</Button>
							</div>
						</header>

						<button
							type="button"
							onClick={() => setDrawerOpen(true)}
							title="Open details panel"
							aria-label="Open details panel"
							className="bg-muted/25 hover:bg-muted/50 group relative flex w-full flex-col gap-6 rounded-2xl p-4 text-left transition-colors duration-300"
						>
							<Info className="text-muted-foreground absolute top-3 right-3 h-4 w-4 opacity-25 transition-opacity duration-300 group-hover:opacity-100" />
							<div className="space-y-2">
								<p className="text-muted-foreground text-[11px] tracking-[0.22em] uppercase">
									Scene Workspace
								</p>

								<div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
									<Badge
										variant={
											sceneState.status === 'published'
												? 'default'
												: 'secondary'
										}
									>
										{sceneState.status === 'published' ? (
											<Radio className="mr-1 h-3 w-3" />
										) : (
											<Cloud className="mr-1 h-3 w-3" />
										)}
										<span className="capitalize">{sceneState.status}</span>
									</Badge>
									<Badge variant="secondary">
										Size {formatBytes(sceneDetails.fileSizeBytes)}
									</Badge>
									<Badge variant="secondary">
										{sceneDetails.assetCount} Assets
									</Badge>
								</div>
							</div>

							<div className="text-muted-foreground flex flex-col gap-3 text-xs md:flex-row md:items-center">
								<p>Updated {new Date(sceneState.updatedAt).toLocaleString()}</p>

								<small className="font-mono">ID {sceneState.id}</small>

								{metadataStatus === 'error' && (
									<span className="text-destructive">
										Save failed. Try again.
									</span>
								)}
							</div>
						</button>
					</section>
				</main>

				<aside className="bg-muted/30 hidden min-h-0 flex-col gap-3 overflow-hidden rounded-2xl p-4 xl:flex">
					<section className="space-y-3">
						<div>
							<p className="text-muted-foreground text-[11px] tracking-[0.2em] uppercase">
								At a Glance
							</p>
							<h2 className="mt-1 text-base leading-tight font-medium tracking-tight">
								Scene Metrics
							</h2>
						</div>
						<div className="grid grid-cols-2 gap-2 text-sm">
							<div className="bg-background/70 rounded-xl p-3">
								<p className="text-muted-foreground text-[11px] uppercase">
									Size
								</p>
								<p className="mt-1 font-medium">
									{formatBytes(sceneDetails.fileSizeBytes)}
								</p>
							</div>
							<div className="bg-background/70 rounded-xl p-3">
								<p className="text-muted-foreground text-[11px] uppercase">
									Assets
								</p>
								<p className="mt-1 font-medium">{sceneDetails.assetCount}</p>
							</div>
							<div className="bg-background/70 rounded-xl p-3">
								<p className="text-muted-foreground text-[11px] uppercase">
									Texture Size
								</p>
								<p className="mt-1 font-medium">
									{sceneDetails.textureBytes != null
										? formatBytes(sceneDetails.textureBytes)
										: sceneDetails.textureCount != null
											? `${sceneDetails.textureCount} textures`
											: '-'}
								</p>
							</div>
							<div className="bg-background/70 rounded-xl p-3">
								<p className="text-muted-foreground text-[11px] uppercase">
									Meshes
								</p>
								<p className="mt-1 font-medium">
									{sceneDetails.meshesCount ?? '-'}</p>
							</div>
						</div>
					</section>

					<section className="space-y-2 overflow-y-auto">
						<p className="text-muted-foreground text-[11px] tracking-[0.2em] uppercase">
							Assets Preview
						</p>
						{sceneDetails.assets.length === 0 ? (
							<p className="text-muted-foreground bg-background/70 rounded-xl p-3 text-sm">
								No linked assets.
							</p>
						) : (
							<div className="space-y-2">
								{sceneDetails.assets.slice(0, 4).map((asset) => (
									<SceneAssetListItem
										key={asset.id}
										{...buildAssetListItemProps(asset, sceneData?.assetData)}
										className="bg-background/70"
									/>
								))}
								{sceneDetails.assets.length > 4 && (
									<button
										type="button"
										onClick={() => setDrawerOpen(true)}
										className="hover:bg-muted/50 bg-background/70 flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left transition-colors duration-300"
									>
										<p className="text-muted-foreground text-sm">
											…and {sceneDetails.assets.length - 4} more.
										</p>
										<ChevronRight className="text-muted-foreground h-4 w-4" />
									</button>
								)}
							</div>
						)}
					</section>

					<section className="bg-background/70 rounded-xl p-3">
						<div className="flex items-center gap-2">
							<Avatar className="h-8 w-8">
								<AvatarImage
									src={user.user_metadata?.avatar_url || ''}
									alt={user.user_metadata?.full_name || user.email || 'User'}
								/>
								<AvatarFallback>
									{(user.user_metadata?.full_name || user.email || 'U')
										.charAt(0)
										.toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<div>
								<p className="text-sm font-medium">Workspace Collaborators</p>
								<p className="text-muted-foreground text-xs">
									Managed in publisher settings.
								</p>
							</div>
						</div>
						<div className="mt-3 flex items-center gap-2">
							<Button
								variant="secondary"
								size="sm"
								onClick={handleCopyDashboardLink}
							>
								{copiedLink ? 'Copied' : 'Copy Link'}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setDrawerOpen(true)}
							>
								Open Details
							</Button>
						</div>
					</section>
				</aside>
			</div>

			<Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
				<DrawerContent className="max-w-xl! border-0">
					<DrawerHeader>
						<div className="flex items-start justify-between gap-3">
							<div>
								<DrawerTitle>Scene Details</DrawerTitle>
								<DrawerDescription>
									Detailed stats, assets, collaboration, and embed options.
								</DrawerDescription>
							</div>
							<DrawerClose asChild>
								<Button
									size="icon"
									variant="ghost"
									aria-label="Close details drawer"
								>
									<X className="h-4 w-4" />
								</Button>
							</DrawerClose>
						</div>
					</DrawerHeader>

					<div className="space-y-6 overflow-y-auto p-6">
						<section className="space-y-3">
							<h3 className="text-sm font-semibold tracking-tight">
								Scene Stats
							</h3>
							<div className="grid grid-cols-2 gap-3 text-sm">
								<div className="bg-muted/50 rounded-xl p-3">
									<p className="text-muted-foreground text-xs">Current Size</p>
									<p className="font-medium">
										{formatBytes(sceneDetails.fileSizeBytes)}
									</p>
								</div>
								<div className="bg-muted/50 rounded-xl p-3">
									<p className="text-muted-foreground text-xs">Assets</p>
									<p className="font-medium">{sceneDetails.assetCount}</p>
								</div>
								<div className="bg-muted/50 rounded-xl p-3">
									<p className="text-muted-foreground text-xs">Texture Size</p>
									<p className="font-medium">
										{sceneDetails.textureBytes != null
											? formatBytes(sceneDetails.textureBytes)
											: sceneDetails.textureCount != null
												? `${sceneDetails.textureCount} textures`
												: '-'}
									</p>
								</div>
								<div className="bg-muted/50 rounded-xl p-3">
									<p className="text-muted-foreground text-xs">
										Meshes / Vertices
									</p>
									<p className="font-medium">
										{sceneDetails.meshesCount ?? '-'} /{' '}
										{sceneDetails.verticesCount ?? '-'}
									</p>
								</div>
							</div>
						</section>

						<DrawerAssetsSection
							assets={sceneDetails.assets}
							assetData={sceneData?.assetData}
						/>

						<Separator />

						<section className="space-y-3">
							<h3 className="text-sm font-semibold tracking-tight">
								Publishing
							</h3>
							<ScenePublishStateControl
								publishState={publishState}
								onPublish={openPublisherForPublishing}
								draftActionMode="immediate"
								publishButtonText="Open Publisher to Publish"
								publishDisabledReason="Publishing is managed in the Publisher workflow to ensure optimized output and texture consistency."
								revokeDialogTitle="Revoke scene publication?"
								revokeDialogDescription="This deletes the published GLB asset and returns this scene to draft state."
							/>
							{publishState.status === 'published' && (
								<div className="space-y-3 pt-1">
									<h4 className="text-sm font-semibold tracking-tight">
										Embed
									</h4>
									<EmbedOptionsPanel
										sceneId={sceneState.id}
										projectId={project.id}
									/>
								</div>
							)}
						</section>

						<Separator />

						<section className="space-y-3">
							<h3 className="text-sm font-semibold tracking-tight">
								Collaboration
							</h3>
							<div className="flex items-center justify-between gap-3">
								<div className="flex items-center gap-2">
									<Avatar className="h-8 w-8">
										<AvatarImage
											src={user.user_metadata?.avatar_url || ''}
											alt={
												user.user_metadata?.full_name || user.email || 'User'
											}
										/>
										<AvatarFallback>
											{(user.user_metadata?.full_name || user.email || 'U')
												.charAt(0)
												.toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div>
										<p className="text-sm font-medium">
											Workspace collaborators
										</p>
										<p className="text-muted-foreground text-xs">
											Detailed access controls are handled in
											publisher/settings.
										</p>
									</div>
								</div>
								<Button
									variant="secondary"
									size="sm"
									onClick={handleCopyDashboardLink}
								>
									{copiedLink ? 'Copied' : 'Copy Link'}
								</Button>
							</div>
						</section>

						<Separator />

						<section className="space-y-3">
							<h3 className="text-sm font-semibold tracking-tight">
								Danger Zone
							</h3>
							<Button
								variant="destructive"
								size="sm"
								onClick={handleDeleteClick}
								className="w-full"
							>
								<Trash2 className="mr-2 h-3.5 w-3.5" />
								Delete Scene
							</Button>
						</section>
					</div>
				</DrawerContent>
			</Drawer>
		</div>
	)
}

export default ScenePage
