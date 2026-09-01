import { Button } from '@shared/components/ui/button'
import { useLoadModel } from '@vctrl/hooks/use-load-model'
import { useCallback, useMemo } from 'react'
import { data, useNavigate } from 'react-router'

import { Route } from './+types/scene'
import CenteredSpinner from '../../../components/centered-spinner'
import {
	InlineEditableMetadataField,
	SceneFactsPanel,
	ScenePreviewOverlay,
	SceneSummaryBar
} from '../../../components/dashboard'
import { DetailPanelSection } from '../../../components/layout-components'
import SceneEmbedViewer from '../../../components/scene-embed/scene-embed-viewer'
import { useSceneMetadata } from '../../../hooks/use-scene-metadata'
import { loadAuthenticatedSession } from '../../../lib/domain/auth/auth-loader.server'
import { toSceneRef } from '../../../lib/domain/dashboard/dashboard-confirmation'
import { resolveSceneMembership } from '../../../lib/domain/dashboard/dashboard-permissions.server'
import { canDeleteScene } from '../../../lib/domain/dashboard/scene-detail-capabilities'
import { buildInternalPreviewPath } from '../../../lib/domain/embed/embed-snippet'
import { getProject } from '../../../lib/domain/project/project-repository.server'
import { useSceneModel } from '../../../lib/domain/scene/client/use-scene-model'
import { getDashboardSceneLoadErrorMessage } from '../../../lib/domain/scene/scene-load-error-messages'
import {
	getScene,
	getSceneFolderAncestry
} from '../../../lib/domain/scene/server/scene-folder-repository.server'
import { getPublishedScenePreview } from '../../../lib/domain/scene/server/scene-preview-repository.server'
import { sceneSettingsService } from '../../../lib/domain/scene/server/scene-settings-service.server'
import { shouldRevalidateForRouteParams } from '../../../lib/navigation/dashboard-route-behavior'
import { toViewerLoadingThumbnail } from '../../../lib/viewer/viewer-loading-thumbnail'

import type { SceneAdditionalMetrics } from '../../../types/api'
import type { SceneDetailsSummary } from '../../../types/dashboard'
import type { ShouldRevalidateFunction } from 'react-router'

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

	const [folderPath, stats, sceneAssets, membership] = await Promise.all([
		scene.folderId
			? getSceneFolderAncestry(scene.folderId, user.id)
			: Promise.resolve([]),
		sceneSettingsService.getSceneStats(sceneId).catch(() => null),
		sceneSettingsService.getSceneAssetRecords(sceneId),
		/*
		  Scene-scoped rather than `buildDashboardCapabilities` over every
		  organization the user belongs to: this page gates exactly one affordance,
		  and this is the resolver `CLAUDE.md` names for a scene actor. The table it
		  feeds is the same one the mutation endpoint enforces with.
		*/
		resolveSceneMembership(sceneId, user.id)
	])

	const publishedMeta = await getPublishedScenePreview(projectId, sceneId)

	const additionalMetrics = stats?.additionalMetrics as
		SceneAdditionalMetrics | null | undefined

	const sceneDetails: SceneDetailsSummary = {
		fileSizeBytes: stats?.currentSceneBytes ?? stats?.initialSceneBytes ?? null,
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
			stats?.optimized?.verticesCount ?? stats?.baseline?.verticesCount ?? null,
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
			sceneDetails,
			canDeleteScene: canDeleteScene(membership)
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

const ScenePage = ({ loaderData }: Route.ComponentProps) => {
	const { scene, project, sceneDetails, publishState, canDeleteScene } =
		loaderData
	const sceneId = scene.id
	const navigate = useNavigate()

	const model = useLoadModel()
	const { file, sceneData, load } = model
	const sceneSource = useMemo(
		() =>
			sceneId
				? ({
						kind: 'server',
						sceneId,
						serverOptions: { endpoint: `/api/scenes/${sceneId}` },
						parseMode: 'direct'
					} as const)
				: null,
		[sceneId]
	)
	useSceneModel(model, sceneSource)

	const metadata = useSceneMetadata(scene)
	const sceneState = metadata.scene

	// Memoized because the viewer is memoized: a fresh object every render would
	// re-render it on every keystroke in the metadata fields below.
	const loadingThumbnail = useMemo(
		() =>
			toViewerLoadingThumbnail(
				sceneState.thumbnailUrl,
				'Scene thumbnail preview'
			),
		[sceneState.thumbnailUrl]
	)

	const previewPath = buildInternalPreviewPath({
		projectId: project.id,
		sceneId: sceneState.id
	})
	const publisherPath = `/publisher/${sceneState.id}`

	const deleteRef = useMemo(
		() =>
			toSceneRef({
				...sceneState,
				// The route knows the publish state two ways and used to pass
				// neither. `publishState` comes from a join on `scene_published` and
				// is the more reliable of the two when they disagree.
				status:
					publishState.status === 'published' ? 'published' : sceneState.status
			}),
		[publishState.status, sceneState]
	)

	/*
	  Deleting succeeds by leaving this page, which is knowledge only the route
	  has - so the menu that owns the dialog takes this rather than the router.
	*/
	const handleDeleted = useCallback(() => {
		navigate(`/dashboard/projects/${project.id}`, { replace: true })
	}, [navigate, project.id])

	const openPublisherForPublishing = useCallback(() => {
		navigate(publisherPath)
	}, [navigate, publisherPath])

	const retrySceneLoad = useCallback(() => {
		if (sceneSource) void load(sceneSource)
	}, [load, sceneSource])

	return (
		/*
		  No height and no scroller of its own below `xl`, deliberately.

		  `dashboard-layout.tsx` already gives its content row a bounded height and
		  its own vertical scroll, so the shell is this page's scroller. This
		  element used to add a second scroller *and* pin itself to the full height
		  of that row, which is the pair that guarantees neither scrolls: the grid
		  below could not grow past the viewport, so its second row was clipped
		  with nothing able to reach it.

		  From `xl` up the height is real - two columns share the shell's row and
		  each owns its own overflow - so it is taken back there and only there.
		*/
		<div className="px-5 pt-1 pb-5 xl:h-full xl:overflow-hidden xl:px-6">
			{sceneState.thumbnailUrl ? (
				<link rel="preload" as="image" href={sceneState.thumbnailUrl} />
			) : null}
			<div className="grid grid-cols-1 gap-4 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_auto]">
				<main className="flex flex-col gap-4 xl:min-h-0">
					{model.status === 'error' ? (
						<DetailPanelSection
							surface="raised"
							title="Unable to Load Scene"
							/*
							  `h2`, because this page renders no `h1`:
							  `dashboard-layout.tsx` suppresses `DashboardHeader` on the
							  scene-detail route, so the section headings here are the top
							  of the document outline rather than a rung inside it.
							*/
							headingLevel="h2"
							description={getDashboardSceneLoadErrorMessage(model.error)}
						>
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
						</DetailPanelSection>
					) : null}
					{/*
					  A bounded height where the page scrolls, and the remaining height
					  where it does not. `svh` rather than a `100vh`-based utility: the
					  large viewport overhangs mobile browser chrome, and this element
					  holds a canvas with `touch-action: none`.
					*/}
					<section className="ds-sunken relative h-[55svh] min-h-64 shrink-0 overflow-hidden rounded-2xl xl:h-auto xl:min-h-0 xl:flex-1">
						<SceneEmbedViewer
							file={file}
							sceneData={sceneData}
							loadingThumbnail={loadingThumbnail}
						/>
						<ScenePreviewOverlay previewPath={previewPath} />
					</section>
					<DetailPanelSection surface="raised" contentClassName="space-y-6">
						<header className="space-y-4">
							{/*
							  The two calls to action get a row of their own beneath the
							  description. They used to be a column beside it, which set the
							  header's height from the tallest thing in it - four stacked
							  buttons - while the title and description next to them were
							  two lines. That is where the void under the description came
							  from.
							*/}
							<div className="space-y-2">
								<InlineEditableMetadataField
									ariaLabel="Scene title"
									value={metadata.nameDraft}
									onChange={metadata.setNameDraft}
									onCommit={metadata.save}
									titleStyle="title"
									placeholder="Scene Title"
									indicatorTitle="Scene title save status"
									isUnsaved={metadata.isTitleUnsaved}
									isSaving={metadata.isSaving && metadata.isUnsaved}
									isSaved={
										metadata.status === 'saved' && !metadata.isTitleUnsaved
									}
								/>
								<InlineEditableMetadataField
									ariaLabel="Scene description"
									multiline
									value={metadata.descriptionDraft}
									onChange={metadata.setDescriptionDraft}
									onCommit={metadata.save}
									placeholder="Scene Description"
									indicatorTitle="Scene description save status"
									isUnsaved={metadata.isDescriptionUnsaved}
									isSaving={metadata.isSaving && metadata.isUnsaved}
									isSaved={
										metadata.status === 'saved' &&
										!metadata.isDescriptionUnsaved
									}
								/>
							</div>
						</header>

						{/*
						  Facts about the scene rather than a control. This was a button
						  opening the details drawer - one of three that did - and it also
						  restated the size and asset count the facts panel now owns.

						  The publication chip is gone from here too. It was the third
						  place this page stated publish state, and the quietest of the
						  three; `ScenePublishPanel` says it once, at the top of the
						  column, with the date and the size beside it.
						*/}
						<div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
							<p>Updated {new Date(sceneState.updatedAt).toLocaleString()}</p>

							<small className="font-mono">ID {sceneState.id}</small>

							{metadata.status === 'error' && (
								<span className="text-destructive">
									Save failed. Try again.
								</span>
							)}
						</div>
					</DetailPanelSection>
				</main>

				{/*
				  Two hosts, one for each side of `xl`, and exactly one of them is
				  ever visible. The aside is the column; the summary bar is what a
				  viewport with no column gets - two figures and two doors, because
				  flowing the full asset list into the page is what made it taller
				  than the shell could scroll.
				*/}
				<SceneFactsPanel
					details={sceneDetails}
					assetData={sceneData?.assetData}
					sceneId={sceneState.id}
					projectId={project.id}
					publishState={publishState}
					publisherPath={publisherPath}
					onPublish={openPublisherForPublishing}
					deleteRef={deleteRef}
					canDelete={canDeleteScene}
					onDeleted={handleDeleted}
				/>
				<SceneSummaryBar
					className="xl:hidden"
					details={sceneDetails}
					assetData={sceneData?.assetData}
					sceneId={sceneState.id}
					projectId={project.id}
					publishState={publishState}
					publisherPath={publisherPath}
					onPublish={openPublisherForPublishing}
					deleteRef={deleteRef}
					canDelete={canDeleteScene}
					onDeleted={handleDeleted}
				/>
			</div>
		</div>
	)
}

export default ScenePage
