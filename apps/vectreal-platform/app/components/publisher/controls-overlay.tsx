import { Button } from '@shared/components/ui/button'
import { ButtonGroup } from '@shared/components/ui/button-group'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger
} from '@shared/components/ui/dropdown-menu'
import { Separator } from '@shared/components/ui/separator'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue } from 'jotai/react'
import { MoreVertical } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import {
	InfoBanner,
	PublishDrawer,
	PublisherSidebar,
	SaveButton,
	SaveLocationConfig,
	SceneInfoTrigger,
	ToolSidebarTriggers
} from '.'
import { useSceneLoader } from '../../hooks'
import { processAtom } from '../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../lib/stores/scene-optimization-store'
import { PublisherLoaderData, SceneAggregateResponse } from '../../types/api'
import { InfoTooltip } from '../info-tooltip'
import { FloatingPillWrapper } from '../layout-components'
import { Navigation } from '../navigation'

import type { SaveLocationTarget } from '../../hooks'

const OverlayControls = ({
	isMobile,
	user,
	sceneId,
	projectId,
	currentLocation,
	sceneAggregate,
	publishedMeta
}: PublisherLoaderData) => {
	const navigate = useNavigate()
	const { file, optimizer } = useModelContext(true)
	const [{ step, showPublishPanel }, setProcessState] = useAtom(processAtom)
	const {
		latestSceneStats,
		optimizedSceneBytes,
		clientSceneBytes,
		optimizedTextureBytes,
		clientTextureBytes
	} = useAtomValue(optimizationRuntimeAtom)
	const [saveLocationTarget, setSaveLocationTarget] =
		useState<SaveLocationTarget>({
			targetProjectId: currentLocation.projectId ?? projectId ?? undefined,
			targetFolderId: currentLocation.folderId ?? null
		})

	// Centralized scene loader - single source of truth (must be inside ModelProvider)
	// This hook manages scene loading/saving but doesn't return state available via atoms
	const { saveSceneSettings, saveAvailability, persistPendingSceneDraft } =
		useSceneLoader({
			sceneId,
			userId: user?.id,
			initialSceneAggregate: sceneAggregate as SceneAggregateResponse | null,
			sceneMeta: sceneAggregate?.meta ?? null
		})

	const isUploadStep = !file?.model && step === 'uploading'
	const isPublished = Boolean(publishedMeta?.publishedAt)
	const currentSceneBytes =
		optimizedSceneBytes ??
		latestSceneStats?.currentSceneBytes ??
		clientSceneBytes

	const handleOpenPublishPanel = useCallback(() => {
		setProcessState((prev) => ({
			...prev,
			showPublishPanel: true,
			showSidebar: false
		}))
	}, [setProcessState])

	const handlePublishPanelChange = useCallback(
		(isOpen: boolean) => {
			setProcessState((prev) => ({
				...prev,
				showPublishPanel: isOpen,
				showSidebar: isOpen ? false : prev.showSidebar
			}))
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
					{user && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon">
									<MoreVertical />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-80">
								<SaveLocationConfig
									currentLocation={currentLocation}
									fallbackProjectId={projectId}
									onChange={setSaveLocationTarget}
								/>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
					<SaveButton
						sceneId={sceneId}
						userId={user?.id}
						saveLocationTarget={saveLocationTarget}
						saveAvailability={saveAvailability}
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
								{isPublished ? 'Published' : 'Draft'}
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
			<InfoBanner sceneBytes={currentSceneBytes} />
			<PublishDrawer
				open={showPublishPanel}
				onOpenChange={handlePublishPanelChange}
				sceneId={sceneId ?? undefined}
				projectId={projectId ?? undefined}
				userId={user?.id}
				saveSceneSettings={saveSceneSettings}
				saveAvailability={saveAvailability}
				info={optimizer.info}
				report={optimizer.report}
				publishedAt={
					typeof publishedMeta?.publishedAt === 'string'
						? publishedMeta.publishedAt
						: (publishedMeta?.publishedAt?.toISOString() ?? null)
				}
				sizeInfo={{
					initialSceneBytes: latestSceneStats?.initialSceneBytes,
					currentSceneBytes:
						optimizedSceneBytes ?? latestSceneStats?.currentSceneBytes,
					initialTextureBytes: clientTextureBytes,
					currentTextureBytes: optimizedTextureBytes
				}}
				stats={latestSceneStats}
				onRequireAuth={handleRequireAuthForSave}
			/>
			<ToolSidebarTriggers />
			<PublisherSidebar user={user} />
		</>
	)
}

export default OverlayControls
