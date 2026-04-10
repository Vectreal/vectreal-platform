import { ButtonGroup } from '@shared/components/ui/button-group'
import { Separator } from '@shared/components/ui/separator'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import {
	InfoBanner,
	PublishSidebar,
	SaveButton,
	SceneInfoTrigger,
	ToolSidebarTriggers,
	ToolSidebar
} from '.'
import { useSceneLoader } from '../../hooks'
import { useLocationChangeState } from '../../hooks/use-location-change-state'
import { useSceneSizeInitializer } from './sidebars/optimize-sidebar/use-scene-size-initializer'
import {
	controlsOverlayStateAtom,
	processAtom,
	saveLocationAtom
} from '../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../lib/stores/scene-optimization-store'
import { PublisherLoaderData, SceneAggregateResponse } from '../../types/api'
import { InfoTooltip } from '../info-tooltip'
import { FloatingPillWrapper } from '../layout-components'
import { Navigation } from '../navigation'

const OverlayControls = ({
	isMobile,
	user,
	sceneId,
	projectId,
	sceneAggregate,
	publishedMeta
}: PublisherLoaderData) => {
	const navigate = useNavigate()
	const { file, isFileLoading, optimizer } = useModelContext(true)
	const { step, showPublishPanel } = useAtomValue(controlsOverlayStateAtom)
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

	// Save location comes from the Jotai atom — initialized in publisher-layout
	// and updated by SceneNameAndLocation picker in the sidebar
	const saveLocationTarget = useAtomValue(saveLocationAtom)
	const { hasUnsavedLocationChange } = useLocationChangeState()

	// Centralized scene loader — single source of truth (must be inside ModelProvider)
	const { saveSceneSettings, saveAvailability, persistPendingSceneDraft } =
		useSceneLoader({
			sceneId,
			userId: user?.id,
			initialSceneAggregate: sceneAggregate as SceneAggregateResponse | null,
			sceneMeta: sceneAggregate?.meta ?? null
		})

	const effectiveSaveAvailability =
		saveAvailability.reason === 'no-unsaved-changes' && hasUnsavedLocationChange
			? {
					...saveAvailability,
					canSave: true,
					reason: 'ready' as const
				}
			: saveAvailability

	const isUploadStep = !file?.model && step === 'uploading'
	const isPublished = Boolean(publishedMeta?.publishedAt)
	const isOptimizerPreparing = optimizer.isPreparing
	const optimizerStatusText = isFileLoading
		? 'Reading model in the background...'
		: isOptimizerPreparing
			? 'Preparing optimizer...'
			: null
	const currentSceneBytes =
		optimizedSceneBytes ??
		clientSceneBytes ??
		latestSceneStats?.currentSceneBytes

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

	return isUploadStep ? (
		<Navigation user={user} isMobile={isMobile} />
	) : (
		<>
			<FloatingPillWrapper className="bg-muted/50 fixed top-0 right-0 z-20 m-4 rounded-2xl p-1 backdrop-blur-2xl">
				<ButtonGroup className="items-center">
					<SaveButton
						sceneId={sceneId}
						userId={user?.id}
						saveLocationTarget={saveLocationTarget}
						saveAvailability={effectiveSaveAvailability}
						onRequireAuth={handleRequireAuthForSave}
						saveSceneSettings={saveSceneSettings}
					/>
				</ButtonGroup>

				{isPublished && (
					<>
						<Separator
							orientation="vertical"
							className="bg-muted-foreground/50 h-4"
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
			</FloatingPillWrapper>
			<SceneInfoTrigger onClick={handleOpenPublishPanel} />
			<InfoBanner
				sceneBytes={currentSceneBytes}
				isLoading={isSceneSizeLoading}
				statusText={optimizerStatusText}
			/>
			<PublishSidebar
				open={showPublishPanel}
				onOpenChange={handlePublishPanelChange}
				isMobile={isMobile}
				sceneId={sceneId ?? undefined}
				projectId={projectId ?? undefined}
				userId={user?.id}
				saveSceneSettings={saveSceneSettings}
				saveAvailability={effectiveSaveAvailability}
				info={optimizer.info}
				report={optimizer.report}
				publishedAt={
					typeof publishedMeta?.publishedAt === 'string'
						? publishedMeta.publishedAt
						: (publishedMeta?.publishedAt?.toISOString() ?? null)
				}
				publishedAssetSizeBytes={
					typeof publishedMeta?.publishedAssetSizeBytes === 'number'
						? publishedMeta.publishedAssetSizeBytes
						: null
				}
				sizeInfo={{
					initialSceneBytes:
						clientSceneBytes ?? latestSceneStats?.initialSceneBytes,
					currentSceneBytes:
						optimizedSceneBytes ??
						clientSceneBytes ??
						latestSceneStats?.currentSceneBytes,
					initialTextureBytes: clientTextureBytes,
					currentTextureBytes: optimizedTextureBytes
				}}
				stats={latestSceneStats}
				onRequireAuth={handleRequireAuthForSave}
			/>
			<ToolSidebarTriggers isMobile={isMobile} />
			<ToolSidebar user={user} isMobile={isMobile} />
		</>
	)
}

export default OverlayControls
