import { Button } from '@shared/components/ui/button'
import { Toggle } from '@shared/components/ui/toggle'
import { ModelExporter } from '@vctrl/core/model-exporter'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { motion } from 'framer-motion'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import { Loader2, Sparkles } from 'lucide-react'
import { useCallback, useMemo, useRef, useState, type FC } from 'react'
import { useNavigate, useRevalidator } from 'react-router'
import { toast } from 'sonner'

import { useSceneViewReturnSetting } from './use-scene-view-return-setting'
import { originalPreset } from '../../../../../constants/optimizations'
import {
	isBillingLimitError,
	toUpgradeModalPayload
} from '../../../../../lib/domain/billing/client/billing-limit-error'
import { optimizationsMatch } from '../../../../../lib/domain/scene/client/optimization-inference'
import {
	lightBakeWarning,
	occlusionBakeWarning,
	publishBakes,
	resolvePublishGeometryOptions,
	runPublishExportInWorker
} from '../../../../../lib/domain/scene/client/publish-export'
import { publishSceneFromGlb } from '../../../../../lib/domain/scene/client/scene-publish'
import {
	shouldShowInfoPopover,
	withCompressTexturesForGpu,
	shouldShowLoadingThumbnail
} from '../../../../../lib/domain/scene/scene-presentation'
import {
	hasUnsavedChangesAtom,
	processAtom
} from '../../../../../lib/stores/publisher-config-store'
import {
	documentOptimizationsAtom,
	optimizationRuntimeAtom
} from '../../../../../lib/stores/scene-optimization-store'
import {
	lightingAtom,
	presentationAtom
} from '../../../../../lib/stores/scene-settings-store'
import {
	buildUpgradeModalState,
	upgradeModalAtom
} from '../../../../../lib/stores/upgrade-modal-store'
import { InlineNotice } from '../../../../layout-components'
import { LoadingThumbnailToggle } from '../../../../publishing/loading-thumbnail-toggle'
import { ScenePublishStateControl } from '../../../../publishing/scene-publish-state-control'
import { useCompressesTexturesForGpu } from '../../../optimization/use-publish-size-projection'
import { itemVariants } from '../../animation'
import { SidebarSection, SidebarSectionContent } from '../../sidebar-section'

import type {
	PublishSceneResponse,
	ScenePublishStateResponse
} from '../../../../../types/api'
import type { SaveSceneFn } from '../../../../../types/publisher-scene'
import type { PublishExportProgress } from '../../../../../workers/publish-export.worker.types'

type PublishStatus = 'idle' | 'saving' | 'publishing' | 'success' | 'error'

interface PublishOptionsProps {
	sceneId?: string
	publishState: ScenePublishStateResponse
	saveSceneSettings: SaveSceneFn
}

export const PublishOptions: FC<PublishOptionsProps> = ({
	sceneId,
	publishState,
	saveSceneSettings
}) => {
	const [publishStatus, setPublishStatus] = useState<PublishStatus>('idle')
	const [publishError, setPublishError] = useState<string | null>(null)
	const [exportProgress, setExportProgress] =
		useState<PublishExportProgress | null>(null)
	const { optimizer, file } = useModelContext(true)
	const navigate = useNavigate()
	const revalidator = useRevalidator()
	const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom)
	// The settings the document was derived from decide the publish-time
	// Draco repack, not edits in the panel that were never applied.
	const optimizations = useAtomValue(documentOptimizationsAtom)
	const {
		dracoReport,
		isPending: isOptimizing,
		passRevision
	} = useAtomValue(optimizationRuntimeAtom)
	const setOptimizationRuntime = useSetAtom(optimizationRuntimeAtom)
	const setUpgradeModal = useSetAtom(upgradeModalAtom)
	const setProcessState = useSetAtom(processAtom)
	const [presentation, setPresentation] = useAtom(presentationAtom)
	const lighting = useAtomValue(lightingAtom)
	const bakes = useMemo(() => publishBakes(lighting), [lighting])
	const sceneViewReturn = useSceneViewReturnSetting()
	const exporterRef = useRef<ModelExporter>(new ModelExporter())
	const isOriginalPreset = optimizationsMatch(optimizations, originalPreset)
	const compressTextures = useCompressesTexturesForGpu()
	const canPublish = Boolean(optimizer?.isReady)
	const isWorking = publishStatus === 'saving' || publishStatus === 'publishing'

	const handlePublish = useCallback(async () => {
		if (!canPublish) {
			setPublishStatus('error')
			setPublishError(
				'Model is not ready yet. Load and optimize your scene first.'
			)
			return
		}

		const document = optimizer?._getDocument?.()
		if (!document) {
			setPublishStatus('error')
			setPublishError('Model not loaded or optimization failed.')
			return
		}

		setPublishStatus('saving')
		setPublishError(null)
		try {
			const requiresSaveBeforePublish = !sceneId || hasUnsavedChanges
			let targetSceneId = sceneId

			if (requiresSaveBeforePublish) {
				setPublishStatus('saving')
				const saveResult = await saveSceneSettings()
				targetSceneId =
					typeof saveResult === 'object' &&
					saveResult &&
					'sceneId' in saveResult
						? (saveResult.sceneId ?? sceneId)
						: sceneId

				if (!sceneId && targetSceneId) {
					navigate(`/publisher/${targetSceneId}`, { replace: true })
				}
			}

			if (!targetSceneId) {
				throw new Error('Save succeeded but scene ID is missing. Please retry.')
			}

			setPublishStatus('publishing')

			const { data: workingGlb } =
				await exporterRef.current.exportDocumentGLB(document)
			const result = await runPublishExportInWorker(
				{
					buffer: workingGlb.slice().buffer as ArrayBuffer,
					...resolvePublishGeometryOptions(optimizations, dracoReport),
					ktx2: compressTextures,
					...bakes
				},
				setExportProgress
			)
			const glbData = new Uint8Array(result.buffer)

			const keptTextures = result.textures?.kept ?? []
			if (keptTextures.length > 0) {
				toast.warning(
					`${keptTextures.length} texture${keptTextures.length === 1 ? '' : 's'} could not be GPU-compressed and shipped as before.`,
					{ description: keptTextures[0].reason }
				)
			}

			const baseName = file?.name?.replace(/\.[^/.]+$/, '') || 'scene'
			const publishResult = await publishSceneFromGlb({
				sceneId: targetSceneId,
				baseFileName: baseName,
				glbData
			})

			// Only once it has shipped, and only if the document exported is the
			// one on screen: the same document object, so no other scene or upload
			// replaced it; no pass running when Publish was pressed; and no pass
			// started since. A pass clears publishedEncoding the moment it starts,
			// before its restore replaces the document, so in between the document
			// check alone would write it back for the document on its way out. The figures
			// then describe that file, in the codecs the export chose, rather than
			// the Draco and WebP projection; otherwise the newer figures win.
			const data = publishResult.response as PublishSceneResponse
			const sameDocument = optimizer?._getDocument?.() === document
			const ktx2Total =
				(result.textures?.encoded.length ?? 0) +
				(result.textures?.kept.length ?? 0)
			setOptimizationRuntime((prev) => ({
				...prev,
				...(data.stats ? { latestSceneStats: data.stats } : {}),
				...(sameDocument && !isOptimizing && prev.passRevision === passRevision
					? {
							optimizedSceneBytes: glbData.byteLength,
							optimizedTextureBytes: result.textureBytes,
							clientSceneBytes: prev.clientSceneBytes ?? glbData.byteLength,
							publishedEncoding: {
								geometryCodec: result.geometryCodec,
								geometrySizes: result.geometrySizes,
								...(result.textures && ktx2Total > 0
									? {
											ktx2Textures: {
												encoded: result.textures.encoded.length,
												total: ktx2Total
											}
										}
									: {})
							}
						}
					: {})
			}))

			// Only once it shipped: the warning says what the published file lacks.
			for (const warning of [
				occlusionBakeWarning(result.occlusion),
				lightBakeWarning(result.lights)
			]) {
				if (warning) {
					toast.warning(warning.message, { description: warning.description })
				}
			}

			const publishStateUpdate: ScenePublishStateResponse =
				publishResult.publishState

			setPublishStatus('success')
			revalidator.revalidate()
			toast.success('Scene published successfully.')
			return publishStateUpdate
		} catch (error) {
			console.error('Failed to publish scene:', error)

			if (isBillingLimitError(error)) {
				const modalPayload = toUpgradeModalPayload(error)
				setUpgradeModal(
					buildUpgradeModalState({
						...modalPayload,
						actionAttempted: 'scene_publish'
					})
				)
			}

			setPublishStatus('error')
			setPublishError(
				error instanceof Error ? error.message : 'Failed to publish scene'
			)
			toast.error(
				error instanceof Error ? error.message : 'Failed to publish scene'
			)
			return
		} finally {
			setExportProgress(null)
		}
	}, [
		canPublish,
		optimizer,
		saveSceneSettings,
		hasUnsavedChanges,
		sceneId,
		navigate,
		revalidator,
		setOptimizationRuntime,
		setUpgradeModal,
		file,
		optimizations,
		dracoReport,
		compressTextures,
		bakes,
		isOptimizing,
		passRevision
	])

	const handleToggleInfoPopover = useCallback(
		(showInfoPopover: boolean) => {
			setPresentation((previous) => ({ ...previous, showInfoPopover }))
		},
		[setPresentation]
	)

	const handleToggleTextureCompression = useCallback(
		(compressTexturesForGpu: boolean) => {
			setPresentation((previous) =>
				withCompressTexturesForGpu(previous, compressTexturesForGpu, {
					isOriginalPreset
				})
			)
		},
		[setPresentation, isOriginalPreset]
	)

	const handleToggleLoadingThumbnail = useCallback(
		(showLoadingThumbnail: boolean) => {
			setPresentation((previous) => ({ ...previous, showLoadingThumbnail }))
		},
		[setPresentation]
	)

	const statusText =
		publishStatus === 'saving'
			? 'Saving latest scene changes before publishing...'
			: publishStatus === 'publishing'
				? exportProgress &&
					exportProgress.texturesDone < exportProgress.texturesTotal
					? `Compressing textures for the GPU (${exportProgress.texturesDone + 1} of ${exportProgress.texturesTotal})...`
					: 'Publishing optimized scene...'
				: publishStatus === 'error'
					? publishError || 'Publishing failed. Retry to continue.'
					: hasUnsavedChanges
						? 'Publish will save your latest changes first.'
						: 'Scene is ready to publish.'

	// Revoking deletes the published GLB, so the size it gave the scene goes
	// with it, here as on the server; what the scene stores describes it again.
	const handlePublishStateChange = useCallback(
		(next: ScenePublishStateResponse) => {
			if (next.status !== 'draft') return
			setOptimizationRuntime((prev) => ({
				...prev,
				latestSceneStats: prev.latestSceneStats
					? { ...prev.latestSceneStats, currentSceneBytes: null }
					: null,
				...(prev.publishedEncoding
					? { optimizedSceneBytes: null, publishedEncoding: null }
					: {})
			}))
		},
		[setOptimizationRuntime]
	)

	return (
		<motion.div variants={itemVariants} className="space-y-3 pb-4">
			<div className="text-muted-foreground text-sm">
				Publish your current optimized scene. This saves first only when there
				are unsaved changes.
			</div>
			{!sceneId && (
				<InlineNotice>
					First publish will save and assign a scene ID automatically.
				</InlineNotice>
			)}

			{/*
			  A section of its own, above the publish control: it describes what
			  ships, and everything below it is the act of shipping. Bare in the
			  column it read as one more status line, which is what the
			  `InlineNotice` strips around it actually are.
			*/}
			<SidebarSection title="Viewer">
				<SidebarSectionContent>
					<Toggle
						checked={shouldShowInfoPopover(presentation)}
						onCheckedChange={handleToggleInfoPopover}
						label="Show scene info"
						description="Adds an info button to the viewer, opening this scene's name and description. Applies to embeds and preview links as soon as you save."
					/>
					<Toggle
						checked={sceneViewReturn.shown}
						onCheckedChange={sceneViewReturn.setShown}
						disabled={!sceneViewReturn.available}
						label="Back to scene view"
						description={
							sceneViewReturn.available
								? 'Offers visitors a way back, by button or Escape, after a hotspot flies the camera to its own view. Applies to embeds and preview links as soon as you save.'
								: 'Shown once a hotspot has its own camera.'
						}
					/>
					<LoadingThumbnailToggle
						checked={shouldShowLoadingThumbnail(presentation)}
						onCheckedChange={handleToggleLoadingThumbnail}
						appliesOn="save"
					/>
				</SidebarSectionContent>
			</SidebarSection>

			<SidebarSection title="Published file">
				<SidebarSectionContent>
					<Toggle
						checked={compressTextures}
						onCheckedChange={handleToggleTextureCompression}
						label="GPU-compressed textures"
						description="Keeps textures compressed on the GPU, so the scene appears sooner and uses less memory, most of all on phones. Publishing takes longer. Off by default on the Original preset."
					/>
					{/* Its payoff shows only once it is on, so it is offered where publishing is decided. */}
					{canPublish && !bakes.occlusion && !bakes.lights && (
						<div className="space-y-2">
							<p className="text-muted-foreground text-xs">
								A studio finish draws soft shadows and depth into the model, so
								every view shows them at no cost.
							</p>
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									setProcessState((prev) => ({
										...prev,
										mode: 'compose',
										activeComposeTool: 'lighting',
										showSidebar: true,
										showPublishPanel: false
									}))
								}
							>
								<Sparkles aria-hidden />
								Add studio finish
							</Button>
						</div>
					)}
				</SidebarSectionContent>
			</SidebarSection>

			<InlineNotice tone="neutral">{statusText}</InlineNotice>

			<ScenePublishStateControl
				publishState={publishState}
				onPublish={handlePublish}
				isPublishActionPending={isWorking}
				isPublishActionDisabled={!canPublish}
				publishDisabledReason={
					!canPublish
						? 'Model is not ready yet. Load and optimize your scene first.'
						: undefined
				}
				publishDialogTitle="Publish Scene?"
				publishDialogDescription="This creates or updates the published GLB for this scene and makes it available as your current published version."
				revokeDialogTitle="Revoke publication?"
				revokeDialogDescription="This removes the published GLB asset and sets this scene back to draft."
				onStateChange={handlePublishStateChange}
			/>

			{isWorking && (
				<div className="text-muted-foreground flex items-center gap-2 text-xs">
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
					{publishStatus === 'saving'
						? 'Saving scene...'
						: 'Publishing scene...'}
				</div>
			)}
		</motion.div>
	)
}
