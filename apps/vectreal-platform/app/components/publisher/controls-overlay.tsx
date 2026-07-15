import { ButtonGroup } from '@shared/components/ui/button-group'
import { Separator } from '@shared/components/ui/separator'
import { cn } from '@shared/utils'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtomValue, useSetAtom } from 'jotai/react'
import posthog from 'posthog-js'
import { useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useSubmit } from 'react-router'
import { toast } from 'sonner'

import {
	DynamicSidebar,
	InfoBanner,
	SaveButton,
	SceneNameAndLocation,
	ToolSidebar
} from '.'
import OptimizationDrawer from './optimization-drawer'
import PreviewCameraControls from './preview-camera-controls'
import { usePublisherViewerCapture } from './publisher-viewer-capture-context'
import { DASHBOARD_ROUTES } from '../../constants/dashboard'
import { useOptimizationModalFlow, useSceneLoader } from '../../hooks'
import { PublishSidebarProvider } from './sidebars/publish-sidebar/publish-sidebar-context'
import { useSceneSizeInitializer } from './sidebars/use-scene-size-initializer'
import { useLocationChangeState } from '../../hooks/use-location-change-state'
import { Navigation } from '../navigation'
import PublishSidebarContent from './sidebars/publish-sidebar/publish-sidebar-content'
import { PublishSidebarTrigger } from './sidebars/publish-sidebar/publish-sidebar-trigger'
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
import { InfoTooltip } from '../info-tooltip'
import { FloatingPillWrapper } from '../layout-components'
import { UserMenu } from '../user-menu'
import { buildPublishSidebarViewModel } from './sidebars/publish-sidebar/publish-sidebar-view-model'

const OverlayControls = ({
	isMobileRequest,
	user,
	sceneId,
	projectId,
	sceneAggregate,
	publishedMeta,
	maxSceneBytes
}: PublisherLoaderData) => {
	const navigate = useNavigate()
	const submit = useSubmit()
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
		handleOpenOptimizationDrawer,
		openReoptimizeDrawer
	} = useOptimizationModalFlow({
		saveAvailability,
		hasUnsavedLocationChange
	})

	const isUploadStep = !file?.model && step === 'uploading'
	const sceneDetailsHref =
		sceneId && projectId
			? DASHBOARD_ROUTES.SCENE_DETAIL(projectId, sceneId)
			: undefined
	const isPublished = Boolean(publishedMeta?.publishedAt)
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
			canReoptimize: Boolean(sceneId)
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

	return isUploadStep && !sceneId ? (
		<Navigation user={user} isMobileRequest={isMobileRequest} />
	) : (
		<>
			<div
				className={cn(
					'fixed top-0 left-1/2 z-30 hidden w-[min(30rem,calc(100vw-22rem))] -translate-x-1/2 px-4 pt-3 md:block',
					arePublisherActionsDisabled &&
						'pointer-events-none opacity-45 saturate-50'
				)}
			>
				<SceneNameAndLocation
					authenticated={!!user}
					className="publisher-shell-floating px-1"
				/>
			</div>

			<div
				className={cn(
					'fixed inset-x-0 top-0 z-30 px-4 pt-[4.25rem] md:hidden',
					arePublisherActionsDisabled &&
						'pointer-events-none opacity-45 saturate-50'
				)}
			>
				<SceneNameAndLocation
					authenticated={!!user}
					className="border-border/60 bg-muted/60 rounded-2xl border px-1 shadow-2xl backdrop-blur-2xl"
				/>
			</div>

			<FloatingPillWrapper className="bg-muted/50 fixed top-0 right-0 z-20 m-4 hidden rounded-2xl p-1 backdrop-blur-2xl md:flex">
				<ButtonGroup className="items-center">
					<SaveButton
						sceneId={sceneId}
						userId={user?.id}
						saveLocationTarget={saveLocationTarget}
						saveAvailability={effectiveSaveAvailability}
						forceDisabled={isPreviewMode}
						onRequireAuth={handleRequireAuthForSave}
						saveSceneSettings={saveSceneSettings}
					/>
				</ButtonGroup>
				{isPublished && (
					<>
						<Separator
							orientation="vertical"
							className="bg-shell-border-strong h-4"
						/>
						<span className="mx-1 mr-3 flex items-center">
							<p className="text-muted-foreground mx-2 text-xs font-medium tracking-wide">
								Published
							</p>
							<InfoTooltip
								content={`Published at: ${new Date(
									publishedMeta?.publishedAt ?? ''
								).toLocaleString()}`}
							/>
						</span>
					</>
				)}
				{user && (
					<UserMenu
						size="sm"
						user={user}
						onLogout={handleLogout}
						sceneDetailsHref={sceneDetailsHref}
					/>
				)}
			</FloatingPillWrapper>

			<FloatingPillWrapper className="bg-muted/50 fixed top-0 right-0 z-50 m-4 flex rounded-2xl p-1 backdrop-blur-2xl md:hidden">
				<ButtonGroup className="items-center gap-1">
					<SaveButton
						sceneId={sceneId}
						userId={user?.id}
						saveLocationTarget={saveLocationTarget}
						saveAvailability={effectiveSaveAvailability}
						forceDisabled={isPreviewMode}
						onRequireAuth={handleRequireAuthForSave}
						saveSceneSettings={saveSceneSettings}
						compact
					/>
					{user ? (
						<UserMenu
							size="sm"
							user={user}
							onLogout={handleLogout}
							sceneDetailsHref={sceneDetailsHref}
						/>
					) : null}
				</ButtonGroup>
			</FloatingPillWrapper>
			<PublishSidebarTrigger
				onClick={handleOpenPublishPanel}
				disabled={arePublisherActionsDisabled}
			/>
			<DynamicSidebar
				open={showPublishPanel}
				onOpenChange={handlePublishPanelChange}
				zIndexClassName="z-[70]"
				isMobile={isMobileRequest}
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
				isMobile={isMobileRequest}
			/>
			<ToolSidebar user={user} isMobile={isMobileRequest} />
			<InfoBanner
				sceneBytes={currentSceneBytes}
				isLoading={isSceneSizeLoading}
				statusText={optimizerStatusText}
				onOpenOptimization={handleOpenOptimizationDrawer}
				disabled={arePublisherActionsDisabled}
			/>

			<PreviewCameraControls />
		</>
	)
}

export default OverlayControls
