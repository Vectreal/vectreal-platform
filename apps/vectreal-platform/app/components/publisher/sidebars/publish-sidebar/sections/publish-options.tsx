import { ModelExporter } from '@vctrl/core/model-exporter'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { motion } from 'framer-motion'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import { Loader2 } from 'lucide-react'
import { useCallback, useRef, useState, type FC } from 'react'
import { useNavigate, useRevalidator } from 'react-router'
import { toast } from 'sonner'

import {
	isBillingLimitError,
	toUpgradeModalPayload
} from '../../../../../lib/domain/billing/client/billing-limit-error'
import { publishSceneFromGlb } from '../../../../../lib/domain/scene/client/scene-publish'
import { shouldShowInfoPopover } from '../../../../../lib/domain/scene/scene-presentation'
import { hasUnsavedChangesAtom } from '../../../../../lib/stores/publisher-config-store'
import {
	optimizationAtom,
	optimizationRuntimeAtom
} from '../../../../../lib/stores/scene-optimization-store'
import { presentationAtom } from '../../../../../lib/stores/scene-settings-store'
import {
	buildUpgradeModalState,
	upgradeModalAtom
} from '../../../../../lib/stores/upgrade-modal-store'
import { InlineNotice } from '../../../../layout-components'
import { ScenePublishStateControl } from '../../../../publishing/scene-publish-state-control'
import { SettingToggle } from '../../../settings-components'
import { itemVariants } from '../../animation'
import { SidebarSection, SidebarSectionContent } from '../../sidebar-section'

import type {
	PublishSceneResponse,
	ScenePublishStateResponse
} from '../../../../../types/api'
import type { SaveSceneFn } from '../../../../../types/publisher-scene'

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
	const { optimizer, file } = useModelContext(true)
	const navigate = useNavigate()
	const revalidator = useRevalidator()
	const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom)
	const { optimizations } = useAtomValue(optimizationAtom)
	const { dracoReport } = useAtomValue(optimizationRuntimeAtom)
	const setOptimizationRuntime = useSetAtom(optimizationRuntimeAtom)
	const setUpgradeModal = useSetAtom(upgradeModalAtom)
	const [presentation, setPresentation] = useAtom(presentationAtom)
	const exporterRef = useRef<ModelExporter>(new ModelExporter())
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

			// Draco is applied here rather than during optimization: the working
			// document stays uncompressed so editing and re-optimizing never
			// re-encode (and degrade) the geometry. `isWorthApplying` is false when
			// the measured compression came out larger than the plain GLB.
			const draco = optimizations.draco
			const shouldCompressGeometry = Boolean(
				draco?.enabled && dracoReport?.isWorthApplying !== false
			)

			const result = shouldCompressGeometry
				? await exporterRef.current.exportDocumentGLBDraco(document, {
						method: draco.method,
						encodeSpeed: draco.encodeSpeed,
						decodeSpeed: draco.decodeSpeed,
						quantizePosition: draco.quantizePosition,
						quantizeNormal: draco.quantizeNormal,
						quantizeColor: draco.quantizeColor,
						quantizeTexcoord: draco.quantizeTexcoord,
						quantizeGeneric: draco.quantizeGeneric
					})
				: await exporterRef.current.exportDocumentGLB(document)
			setOptimizationRuntime((prev) => ({
				...prev,
				optimizedSceneBytes: result.size,
				clientSceneBytes: prev.clientSceneBytes ?? result.size
			}))
			const baseName = file?.name?.replace(/\.[^/.]+$/, '') || 'scene'
			const publishResult = await publishSceneFromGlb({
				sceneId: targetSceneId,
				baseFileName: baseName,
				glbData:
					result.data instanceof Uint8Array
						? result.data
						: new Uint8Array(result.data),
				currentSceneBytes: Number.isFinite(result.size)
					? result.size
					: undefined
			})

			const data = publishResult.response as PublishSceneResponse
			if (data.stats) {
				setOptimizationRuntime((prev) => ({
					...prev,
					latestSceneStats: data.stats
				}))
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
		optimizations.draco,
		dracoReport
	])

	const handleToggleInfoPopover = useCallback(
		(showInfoPopover: boolean) => {
			setPresentation((previous) => ({ ...previous, showInfoPopover }))
		},
		[setPresentation]
	)

	const statusText =
		publishStatus === 'saving'
			? 'Saving latest scene changes before publishing...'
			: publishStatus === 'publishing'
				? 'Publishing optimized scene...'
				: publishStatus === 'error'
					? publishError || 'Publishing failed. Retry to continue.'
					: hasUnsavedChanges
						? 'Publish will save your latest changes first.'
						: 'Scene is ready to publish.'

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
					<SettingToggle
						enabled={shouldShowInfoPopover(presentation)}
						onToggle={handleToggleInfoPopover}
						title="Show scene info"
						description="Adds an info button to the viewer, opening this scene's name and description. Applies to embeds and preview links as soon as you save."
					/>
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
