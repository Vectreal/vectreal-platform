import { Button } from '@shared/components/ui/button'
import { Separator } from '@shared/components/ui/separator'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue } from 'jotai/react'
import { Cloud, CloudUpload, Sparkles } from 'lucide-react'
import { useCallback } from 'react'
import { useFetcher, useNavigate } from 'react-router'
import { toast } from 'sonner'

import {
	InfoBanner,
	PublishDrawer,
	PublisherSidebar,
	SceneInfoTrigger,
	ToolSidebarTriggers
} from '.'
import { SaveSceneResult, useSceneLoader } from '../../hooks'
import { processAtom } from '../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../lib/stores/scene-optimization-store'
import { PublisherLoaderData, SceneAggregateResponse } from '../../types/api'
import { InfoTooltip } from '../info-tooltip'
import { FloatingPillWrapper } from '../layout-components'
import { Navigation } from '../navigation'
import { UserMenu } from '../user-menu'

const OverlayControls = ({
	isMobile,
	user,
	sceneId,
	projectId,
	sceneAggregate,
	publishedMeta
}: PublisherLoaderData) => {
	const { file, optimizer } = useModelContext(true)
	const [{ step, isSaving, showPublishPanel }, setProcessState] =
		useAtom(processAtom)
	const {
		latestSceneStats,
		optimizedSceneBytes,
		clientSceneBytes,
		optimizedTextureBytes,
		clientTextureBytes
	} = useAtomValue(optimizationRuntimeAtom)
	const navigate = useNavigate()
	const { submit } = useFetcher()

	// Centralized scene loader - single source of truth (must be inside ModelProvider)
	// This hook manages scene loading/saving but doesn't return state available via atoms
	const { saveSceneSettings, saveAvailability } = useSceneLoader({
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
	const isSaveDisabled = isSaving || !saveAvailability.canSave || !user?.id

	const saveActionLabel = isSaving
		? 'Saving...'
		: saveAvailability.reason === 'requires-first-optimization'
			? 'Optimize First'
			: saveAvailability.reason === 'no-unsaved-changes'
				? 'Saved'
				: 'Save'

	async function handleLogout() {
		await submit(null, {
			method: 'get',
			action: '/auth/logout'
		})
	}

	const handleSaveScene = useCallback(async () => {
		if (!user?.id) {
			toast.error('Missing required information to save scene setting')
			return
		}

		setProcessState((prev) => ({ ...prev, isSaving: true }))

		try {
			const result = (await saveSceneSettings()) as
				| SaveSceneResult
				| { unchanged: true }
				| undefined

			if (result) {
				if (result.unchanged) {
					toast.info('No changes were detected - scene is already up to date')
				} else {
					toast.success('Scene settings saved successfully!')
					if (!sceneId && result.sceneId) {
						navigate(`/publisher/${result.sceneId}`, { replace: true })
					}
				}
			} else {
				toast.error('Failed to save scene settings')
			}
		} catch (error) {
			console.error('Error saving scene settings:', error)
			const errorMessage =
				error instanceof Error
					? error.message
					: 'An error occurred while saving'

			if (errorMessage.includes('User not found in local database')) {
				toast.error(
					'Authentication error. Please sign out and sign back in to continue.',
					{
						duration: 6000,
						action: {
							label: 'Sign Out',
							onClick: () => {
								window.location.href = '/auth/signout'
							}
						}
					}
				)
			} else if (errorMessage.includes('Missing required information')) {
				toast.error(
					'Missing required information. Please try refreshing the page.'
				)
			} else {
				toast.error(`Failed to save: ${errorMessage}`)
			}
		} finally {
			setProcessState((prev) => ({ ...prev, isSaving: false }))
		}
	}, [navigate, saveSceneSettings, sceneId, setProcessState, user?.id])

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

	return isUploadStep ? (
		<Navigation user={user} isMobile={isMobile} />
	) : (
		<>
			{user && (
				<FloatingPillWrapper className="bg-muted/50 fixed top-0 right-0 z-20 m-4 rounded-2xl p-2 py-1 backdrop-blur-2xl">
					<Button
						variant="ghost"
						size="sm"
						className="rounded-xl"
						disabled={isSaveDisabled}
						onClick={handleSaveScene}
					>
						{saveActionLabel}
						{saveAvailability.reason === 'requires-first-optimization' ? (
							<Sparkles size={16} className="inline animate-pulse" />
						) : saveAvailability.reason === 'no-unsaved-changes' ? (
							<Cloud size={16} className="inline" />
						) : (
							<CloudUpload size={16} className="inline" />
						)}
					</Button>
					{isPublished && (
						<>
							<Separator
								orientation="vertical"
								className="bg-muted-foreground/50 h-4"
							/>
							<span className="mx-1 flex items-center">
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
					<UserMenu size="sm" user={user} onLogout={handleLogout} />
				</FloatingPillWrapper>
			)}
			<SceneInfoTrigger onClick={handleOpenPublishPanel} />
			<InfoBanner sceneBytes={currentSceneBytes} />
			<PublishDrawer
				open={showPublishPanel}
				onOpenChange={handlePublishPanelChange}
				userId={user?.id}
				sceneId={sceneId ?? undefined}
				projectId={projectId ?? undefined}
				saveSceneSettings={saveSceneSettings}
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
			/>
			<ToolSidebarTriggers />
			<PublisherSidebar />
		</>
	)
}

export default OverlayControls
