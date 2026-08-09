import { useIsMobile } from '@shared/components/hooks/use-mobile'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtomValue, useSetAtom } from 'jotai/react'
import posthog from 'posthog-js'
import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { useNavigate, useSubmit } from 'react-router'
import { toast } from 'sonner'

import { DynamicSidebar, ToolSidebar } from '.'
import OptimizationDrawer from './optimization/optimization-drawer'
import PreviewCameraControls from './preview-camera-controls'
import { usePublisherViewerCapture } from './publisher-viewer-capture-context'
import { PreviewModeBadge } from './shell/preview-mode-badge'
import { PublishCard } from './shell/publish-card'
import { PublisherHeader } from './shell/publisher-header'
import { PUBLISHER_LAYER } from './shell/shell-layout'
import { DASHBOARD_ROUTES } from '../../constants/dashboard'
import { useOptimizationModalFlow, useSceneLoader } from '../../hooks'
import { useHideGlobalNav } from '../navigation/global-nav-visibility'
import PublishSidebarContent from './sidebars/publish-sidebar/publish-sidebar-content'
import { PublishSidebarProvider } from './sidebars/publish-sidebar/publish-sidebar-context'
import { useSceneSizeInitializer } from './sidebars/use-scene-size-initializer'
import { useLocationChangeState } from '../../hooks/use-location-change-state'
import { resolveSceneMetrics } from '../../lib/domain/scene'
import {
	arePublisherActionsDisabledAtom,
	controlsOverlayStateAtom,
	isPreviewModeAtom,
	lastSavedSceneIdAtom,
	processAtom,
	saveLocationAtom
} from '../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../lib/stores/scene-optimization-store'
import { PublisherLoaderData, SceneManifestResponse } from '../../types/api'
import { buildPublishSidebarViewModel } from './sidebars/publish-sidebar/publish-sidebar-view-model'

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
	sceneAggregate,
	publishedMeta,
	maxSceneBytes,
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
	const { file, isFileLoading, optimizer } = useModelContext(true)
	const { step, showPublishPanel } = useAtomValue(controlsOverlayStateAtom)
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
	const { requestSceneScreenshot, requestShadowBake } =
		usePublisherViewerCapture()

	// Centralized scene loader - single source of truth (must be inside ModelProvider)
	const { saveSceneSettings, saveAvailability, persistPendingSceneDraft } =
		useSceneLoader({
			sceneId,
			userId: user?.id,
			initialSceneAggregate: sceneAggregate as SceneManifestResponse | null,
			sceneMeta: sceneAggregate?.meta ?? null,
			requestSceneScreenshot,
			requestShadowBake
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
	} = useOptimizationModalFlow({
		saveAvailability,
		hasUnsavedLocationChange
	})

	const isUploadStep = !file?.model && step === 'uploading'

	/*
	  Pre-upload with no scene: there is nothing to frame yet, so the site nav
	  stands in for the header. Everywhere else the publisher owns the top of the
	  viewport, so the nav (owned by nav-layout) steps aside.

	  `routePageChrome` already covers this for `/publisher/:sceneId` at SSR. The
	  case only this can catch is a model dropped at `/publisher`, which swaps the
	  nav for the header without navigating.
	*/
	const showSiteNav = isUploadStep && !sceneId
	useHideGlobalNav(!showSiteNav)

	const sceneDetailsHref =
		sceneId && projectId
			? DASHBOARD_ROUTES.SCENE_DETAIL(projectId, sceneId)
			: undefined
	const isOptimizerPreparing = optimizer.isPreparing
	const optimizerStatusText = isFileLoading
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

		const nextPathBase = sceneId ? `/publisher/${sceneId}` : '/publisher'
		const nextPath = `${nextPathBase}?restore_draft=1&draft_id=${encodeURIComponent(draftId)}`
		const authPath = `/sign-in?next=${encodeURIComponent(nextPath)}&scene_saved=true`
		navigate(authPath)
	}, [persistPendingSceneDraft, sceneId, navigate])

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
			onOpenOptimizationDrawer: openReoptimizeDrawer,
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

	useEffect(() => {
		if (!isPreviewMode) {
			return
		}

		setProcessState((prev) => {
			if (!prev.showSidebar && !prev.showPublishPanel) {
				return prev
			}

			return {
				...prev,
				showSidebar: false,
				showPublishPanel: false
			}
		})
	}, [isPreviewMode, setProcessState])

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

	// Pre-upload with no scene: the site nav (kept mounted by nav-layout) stands
	// in for the header, and the stage chrome has nothing to show.
	if (showSiteNav) {
		return <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
	}

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
			/>

			{/*
			  Row 2. This is the positioning ancestor for every piece of floating
			  canvas chrome — the tool rail, the publish card, the preview
			  controls, and both sidebars all anchor to it with `absolute`, which
			  is what keeps them from spilling over the header.
			*/}
			<div className="relative flex min-h-0 flex-1 flex-col">
				{children}

				<ToolSidebar user={user} isMobile={isMobile} />

				<PublishCard
					sceneBytes={currentSceneBytes}
					isSceneSizeLoading={isSceneSizeLoading}
					statusText={optimizerStatusText}
					isPublished={Boolean(publishedAt)}
					onOpenPublishPanel={handleOpenPublishPanel}
					onOpenOptimization={handleOpenOptimizationDrawer}
					disabled={arePublisherActionsDisabled}
				/>

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
						<PublishSidebarContent hideHeader showSceneInfo />
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

				<PreviewModeBadge />

				<PreviewCameraControls />
			</div>
		</>
	)
}

export default OverlayControls
