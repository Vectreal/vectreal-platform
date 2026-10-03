import { useIsMobile } from '@shared/components/hooks/use-mobile'
import { cn } from '@shared/utils'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtomValue, useSetAtom } from 'jotai/react'
import posthog from 'posthog-js'
import { useCallback, useMemo, type ReactNode } from 'react'
import { useNavigate, useNavigation, useSubmit } from 'react-router'
import { toast } from 'sonner'

import { DynamicSidebar, ToolSidebar } from '.'
import OptimizationDrawer from './optimization/optimization-drawer'
import PreviewCameraControls from './preview-camera-controls'
import { SaveProgressPanel } from './save-progress/save-progress-panel'
import { EmptyStage } from './shell/empty-stage'
import { PublishCard } from './shell/publish-card'
import { PublisherHeader } from './shell/publisher-header'
import { PublisherSurfaceFallback } from './shell/publisher-surface-fallback'
import { PUBLISHER_EDGE_INSET, PUBLISHER_LAYER } from './shell/shell-layout'
import { ToolBar } from './shell/tool-bar'
import PublishSidebarContent from './sidebars/publish-sidebar/publish-sidebar-content'
import { PublishSidebarProvider } from './sidebars/publish-sidebar/publish-sidebar-context'
import { buildPublishSidebarViewModel } from './sidebars/publish-sidebar/publish-sidebar-view-model'
import { useSceneSizeInitializer } from './sidebars/use-scene-size-initializer'
import { DASHBOARD_ROUTES } from '../../constants/dashboard'
import { useOptimizationDrawerFlow, usePublisherScene } from '../../hooks'
import { useLocationChangeState } from '../../hooks/use-location-change-state'
import { usePublisherSaveAction } from '../../hooks/use-publisher-save-action'
import { useSampleDownload } from '../../hooks/use-sample-download'
import { resolveSceneMetrics } from '../../lib/domain/scene'
import { resolvePublisherSurface } from '../../lib/publisher/publisher-surface'
import {
	arePublisherActionsDisabledAtom,
	isPreviewModeAtom,
	lastSavedSceneIdAtom,
	processAtom,
	saveLocationAtom,
	showPublishPanelAtom
} from '../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../lib/stores/scene-optimization-store'
import { PublisherLoaderData } from '../../types/api'

/**
 * The publisher shell: a three-row grid of header, canvas stage, and footer.
 *
 * It owns the scene-loader state the rows and sidebars all read from, so the
 * canvas arrives as `children` rather than as a sibling of a pile of
 * fixed-position overlays.
 */
const OverlayControls = ({
	isMobileRequest,
	user,
	sceneId,
	projectId,
	sceneManifest,
	publishedMeta,
	maxSceneBytes,
	recentScenes,
	children
}: PublisherLoaderData & { children: ReactNode }) => {
	const navigate = useNavigate()
	const submit = useSubmit()
	/*
	  The request hint only seeds the first paint. `/publisher` is `no-store` and
	  never prerendered, so the user-agent is a real signal here — but it answers
	  the wrong question after that, since the sidebars swap to drawers on a 768px
	  breakpoint, not on a device class. A narrow desktop window wants drawers too.
	*/
	const isMobile = useIsMobile(isMobileRequest)
	const { status, optimizer } = useModelContext(true)
	const showPublishPanel = useAtomValue(showPublishPanelAtom)
	const arePublisherActionsDisabled = useAtomValue(
		arePublisherActionsDisabledAtom
	)
	const isPreviewMode = useAtomValue(isPreviewModeAtom)
	const setProcessState = useSetAtom(processAtom)
	const {
		latestSceneStats,
		isSceneSizeLoading,
		optimizedSceneBytes,
		clientSceneBytes,
		optimizedTextureBytes,
		clientTextureBytes
	} = useAtomValue(optimizationRuntimeAtom)

	// Ensure scene size is calculated and bottom bar is populated before the tool
	// sidebar is opened for the first time.
	useSceneSizeInitializer()

	// Save location comes from the Jotai atom - initialized in publisher-layout
	// and updated by the shell-level SceneNameAndLocation picker.
	const saveLocationTarget = useAtomValue(saveLocationAtom)
	// Confirmed persisted-save signal (set only after a successful, non-unchanged
	// save). Used to reveal publish sections immediately on first save, bridging the
	// gap until the route param updates to the new scene id post-navigation.
	const sessionSavedSceneId = useAtomValue(lastSavedSceneIdAtom)
	const { hasUnsavedLocationChange } = useLocationChangeState()

	const {
		openSceneId,
		isRestoringDraft,
		uploadFiles,
		retrySceneLoad,
		saveSceneSettings,
		saveAvailability,
		persistPendingSceneDraft
	} = usePublisherScene({
		sceneId,
		userId: user?.id,
		sceneManifest
	})

	const {
		effectiveSaveAvailability,
		requiresSizeReduction,
		isOptimizationDrawerOpen,
		handleOptimizationDrawerChange,
		// Two ways in, by design. The card's size line is the direct route from
		// the signal itself; the sidebar's Delivery section is the one you meet
		// on the way to publishing.
		handleOpenOptimizationDrawer,
		openReoptimizeDrawer
	} = useOptimizationDrawerFlow({
		saveAvailability,
		hasUnsavedLocationChange
	})

	/*
	  The one place that decides what the publisher is showing. The canvas stage
	  below and the chrome around it both read it, so they cannot disagree.
	*/
	const navigation = useNavigation()
	const surface = resolvePublisherSurface({
		status,
		hasScene: Boolean(openSceneId),
		// Navigating within the publisher (to a scene just saved, or between
		// scenes) is a load, and so is reading a signed-in draft back out of
		// IndexedDB: in both, a model is on its way and the stage should wait.
		isNavigating:
			isRestoringDraft ||
			(navigation.state === 'loading' &&
				Boolean(navigation.location?.pathname?.startsWith('/publisher')))
	})
	// Here rather than in the empty stage, which a revalidation unmounts mid-download: see its `sampleDownload`.
	const sampleDownload = useSampleDownload()
	/*
	  The rail, the publish card, the sidebars and the header's scene controls
	  act on a scene, so an empty stage has none of them: nothing on screen is a
	  control that cannot do anything yet. The header itself stays, carrying the
	  way home and the account, as it does in every state.
	*/
	const showSceneChrome = surface !== 'empty'

	const sceneDetailsHref =
		sceneId && projectId
			? DASHBOARD_ROUTES.SCENE_DETAIL(projectId, sceneId)
			: undefined
	const isOptimizerPreparing = optimizer.isPreparing
	const optimizerStatusText =
		status === 'loading'
			? 'Reading model in the background...'
			: isOptimizerPreparing
				? 'Preparing optimizer...'
				: null
	const resolvedSceneMetrics = useMemo(
		() =>
			resolveSceneMetrics({
				stats: latestSceneStats,
				report: optimizer.report,
				info: optimizer.info,
				runtime: {
					initialSceneBytes: clientSceneBytes,
					currentSceneBytes: optimizedSceneBytes,
					initialTextureBytes: clientTextureBytes,
					currentTextureBytes: optimizedTextureBytes,
					isSceneSizeComputing: isSceneSizeLoading
				}
			}),
		[
			latestSceneStats,
			optimizer.report,
			optimizer.info,
			clientSceneBytes,
			optimizedSceneBytes,
			clientTextureBytes,
			optimizedTextureBytes,
			isSceneSizeLoading
		]
	)
	const currentSceneBytes = resolvedSceneMetrics.sceneBytes.current
	const publishedAt =
		typeof publishedMeta?.publishedAt === 'string'
			? publishedMeta.publishedAt
			: (publishedMeta?.publishedAt?.toISOString() ?? null)

	const handleRequireAuthForSave = useCallback(async () => {
		const draftId = await persistPendingSceneDraft()
		if (!draftId) {
			toast.error(
				'We could not preserve your unsaved scene in this browser before sign-in.'
			)
			return
		}

		const nextPathBase = openSceneId
			? `/publisher/${openSceneId}`
			: '/publisher'
		const nextPath = `${nextPathBase}?restore_draft=1&draft_id=${encodeURIComponent(draftId)}`
		const authPath = `/sign-in?next=${encodeURIComponent(nextPath)}&scene_saved=true`
		navigate(authPath)
	}, [persistPendingSceneDraft, openSceneId, navigate])

	// The save panel's Retry runs the same save the header's Save button does.
	const { handleSaveScene } = usePublisherSaveAction({
		sceneId,
		userId: user?.id,
		saveLocationTarget,
		onRequireAuth: handleRequireAuthForSave,
		saveSceneSettings
	})

	const publishSidebarViewModel = useMemo(
		() =>
			buildPublishSidebarViewModel({
				sceneId: sceneId ?? undefined,
				sessionSavedSceneId: sessionSavedSceneId ?? undefined,
				userId: user?.id,
				publishedAt,
				publishedAssetSizeBytes:
					typeof publishedMeta?.publishedAssetSizeBytes === 'number'
						? publishedMeta.publishedAssetSizeBytes
						: null,
				resolvedMetrics: resolvedSceneMetrics
			}),
		[
			sceneId,
			sessionSavedSceneId,
			user?.id,
			publishedAt,
			publishedMeta?.publishedAssetSizeBytes,
			resolvedSceneMetrics
		]
	)

	const publishSidebarValue = useMemo(
		() => ({
			// Prefer the session-resolved id so the publish/embed actions (and the
			// sidebar's own save) operate on the just-saved scene during the window
			// before the route param catches up, avoiding a redundant re-save and an
			// empty embed snippet.
			sceneId: publishSidebarViewModel.publishState.sceneId || undefined,
			projectId: projectId ?? undefined,
			userId: user?.id,
			onRequireAuth: handleRequireAuthForSave,
			saveSceneSettings,
			saveAvailability: effectiveSaveAvailability,
			viewModel: publishSidebarViewModel,
			onOpenOptimizationDrawer: openReoptimizeDrawer
		}),
		[
			sceneId,
			projectId,
			user?.id,
			handleRequireAuthForSave,
			saveSceneSettings,
			effectiveSaveAvailability,
			publishSidebarViewModel,
			openReoptimizeDrawer
		]
	)

	const handleOpenPublishPanel = useCallback(() => {
		setProcessState((prev) => {
			if (prev.showPublishPanel && !prev.showSidebar) {
				return prev
			}

			return {
				...prev,
				showPublishPanel: true,
				showSidebar: false
			}
		})
	}, [setProcessState])

	const handleLogout = useCallback(async () => {
		posthog?.reset()
		await submit(null, { method: 'post', action: '/auth/logout' })
	}, [posthog, submit])

	const handlePublishPanelChange = useCallback(
		(isOpen: boolean) => {
			setProcessState((prev) => {
				const nextShowSidebar = isOpen ? false : prev.showSidebar
				if (
					prev.showPublishPanel === isOpen &&
					prev.showSidebar === nextShowSidebar
				) {
					return prev
				}

				return {
					...prev,
					showPublishPanel: isOpen,
					showSidebar: nextShowSidebar
				}
			})
		},
		[setProcessState]
	)

	return (
		<>
			<PublisherHeader
				user={user}
				sceneId={sceneId}
				sceneDetailsHref={sceneDetailsHref}
				saveLocationTarget={saveLocationTarget}
				saveAvailability={effectiveSaveAvailability}
				saveSceneSettings={saveSceneSettings}
				onRequireAuth={handleRequireAuthForSave}
				onLogout={handleLogout}
				publishedAt={publishedAt}
				isPreviewMode={isPreviewMode}
				actionsDisabled={arePublisherActionsDisabled}
				showSceneControls={showSceneChrome}
			/>

			{/*
			  Row 2. This is the positioning ancestor for every piece of floating
			  canvas chrome — the tool bar, the publish card, the preview
			  controls, and both sidebars all anchor to it with `absolute`, which
			  is what keeps them from spilling over the header.
			*/}
			<div className="relative flex min-h-0 flex-1 flex-col">
				{surface === 'empty' ? (
					<EmptyStage
						isMobile={isMobile}
						onUpload={uploadFiles}
						sampleDownload={sampleDownload}
						recentScenes={recentScenes}
					/>
				) : (
					/*
					  One fade as the stage leaves the empty state, on a box that stays
					  mounted from the loading screen to the model, so it runs once
					  however many hands the load passes through. It is not positioned,
					  so the floating chrome below still anchors to this row.
					*/
					<div className="animate-fade-in flex min-h-0 flex-1 flex-col">
						{surface === 'viewer' ? (
							children
						) : (
							<PublisherSurfaceFallback
								surface={surface}
								onRetry={retrySceneLoad}
							/>
						)}
					</div>
				)}

				{showSceneChrome && (
					<>
						<ToolBar />

						<ToolSidebar isMobile={isMobile} />

						<div
							className={cn(
								// Only the surfaces in the column take the pointer: the card
								// keeps its space while preview hides it, and the canvas
								// under that space must stay draggable.
								'pointer-events-none absolute top-0 right-0 bottom-0 flex w-60 flex-col justify-end gap-2',
								PUBLISHER_EDGE_INSET,
								PUBLISHER_LAYER.card
							)}
						>
							<SaveProgressPanel onRetry={() => void handleSaveScene()} />
							<PublishCard
								sceneBytes={currentSceneBytes}
								isSceneSizeLoading={isSceneSizeLoading}
								statusText={optimizerStatusText}
								isPublished={Boolean(publishedAt)}
								onOpenPublishPanel={handleOpenPublishPanel}
								onOpenOptimization={handleOpenOptimizationDrawer}
								disabled={arePublisherActionsDisabled}
							/>
						</div>

						<DynamicSidebar
							open={showPublishPanel}
							onOpenChange={handlePublishPanelChange}
							zIndexClassName={PUBLISHER_LAYER.sidebar}
							isMobile={isMobile}
							direction="right"
							title="Scene Info & Publish"
							description="Save, publish, and embed your latest scene."
							showDesktopHeader
						>
							<PublishSidebarProvider value={publishSidebarValue}>
								<PublishSidebarContent />
							</PublishSidebarProvider>
						</DynamicSidebar>

						<OptimizationDrawer
							open={isOptimizationDrawerOpen}
							onOpenChange={handleOptimizationDrawerChange}
							isOverSizeLimit={requiresSizeReduction}
							maxSceneBytes={maxSceneBytes}
							dashboardHref={sceneDetailsHref ?? '/dashboard'}
							isMobile={isMobile}
						/>

						<PreviewCameraControls />
					</>
				)}
			</div>
		</>
	)
}

export default OverlayControls
