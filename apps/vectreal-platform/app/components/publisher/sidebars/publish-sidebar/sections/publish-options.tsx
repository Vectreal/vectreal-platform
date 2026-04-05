import { ModelExporter } from '@vctrl/core/model-exporter'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { motion } from 'framer-motion'
import { useAtomValue, useSetAtom } from 'jotai'
import { Loader2 } from 'lucide-react'
import { useCallback, useRef, useState, type FC } from 'react'
import { useNavigate, useRevalidator } from 'react-router'
import { toast } from 'sonner'

import {
	isBillingLimitError,
	toUpgradeModalPayload
} from '../../../../../lib/domain/billing/client/billing-limit-error'
import { publishSceneFromGlb } from '../../../../../lib/domain/scene/client/scene-publish'
import { processAtom } from '../../../../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../../../../lib/stores/scene-optimization-store'
import {
	buildUpgradeModalState,
	upgradeModalAtom
} from '../../../../../lib/stores/upgrade-modal-store'
import { ScenePublishStateControl } from '../../../../publishing/scene-publish-state-control'
import { itemVariants } from '../../animation'

import type { SaveSceneFn } from '../../../../../hooks'
import type {
	PublishSceneResponse,
	ScenePublishStateResponse
} from '../../../../../types/api'

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
	const { hasUnsavedChanges } = useAtomValue(processAtom)
	const setOptimizationRuntime = useSetAtom(optimizationRuntimeAtom)
	const setUpgradeModal = useSetAtom(upgradeModalAtom)
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

			const result = await exporterRef.current.exportDocumentGLB(document)
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
		file
	])

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
		<motion.div variants={itemVariants} className="space-y-4 px-2 py-2">
			<div className="text-muted-foreground text-sm">
				Publish your current optimized scene. This saves first only when there
				are unsaved changes.
			</div>
			{!sceneId && (
				<div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
					First publish will save and assign a scene ID automatically.
				</div>
			)}

			<div className="border-border/60 bg-muted/30 text-muted-foreground rounded-md border px-3 py-2 text-xs">
				{statusText}
			</div>

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
