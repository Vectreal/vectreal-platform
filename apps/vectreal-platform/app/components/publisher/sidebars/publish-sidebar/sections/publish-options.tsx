import { Button } from '@shared/components/ui/button'
import { ModelExporter } from '@vctrl/core/model-exporter'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { motion } from 'framer-motion'
import { useAtomValue, useSetAtom } from 'jotai'
import { AlertCircle, CheckCircle, Loader2, RefreshCcw } from 'lucide-react'
import { useCallback, useRef, useState, type FC } from 'react'
import { useNavigate, useRevalidator } from 'react-router'
import { toast } from 'sonner'

import { processAtom } from '../../../../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../../../../lib/stores/scene-optimization-store'
import { itemVariants } from '../../animation'

import type { PublishSceneResponse } from '../../../../../types/api'

type PublishStatus = 'idle' | 'saving' | 'publishing' | 'success' | 'error'

interface PublishOptionsProps {
	sceneId?: string
	saveSceneSettings: () => Promise<
		{ sceneId?: string; unchanged?: boolean; [key: string]: unknown } |
			{ unchanged: true } |
			undefined
	>
}

export const PublishOptions: FC<PublishOptionsProps> = ({
	sceneId,
	saveSceneSettings
}) => {
	const [publishStatus, setPublishStatus] = useState<PublishStatus>('idle')
	const [publishError, setPublishError] = useState<string | null>(null)
	const { optimizer, file } = useModelContext(true)
	const navigate = useNavigate()
	const revalidator = useRevalidator()
	const { hasUnsavedChanges } = useAtomValue(processAtom)
	const setOptimizationRuntime = useSetAtom(optimizationRuntimeAtom)
	const exporterRef = useRef<ModelExporter>(new ModelExporter())
	const canPublish = Boolean(optimizer?._getDocument?.())
	const isWorking = publishStatus === 'saving' || publishStatus === 'publishing'

	const handlePublish = useCallback(async () => {
		if (!canPublish) {
			setPublishStatus('error')
			setPublishError('Model is not ready yet. Load and optimize your scene first.')
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
			const saveResult = await saveSceneSettings()
			const targetSceneId =
				typeof saveResult === 'object' && saveResult && 'sceneId' in saveResult
					? (saveResult.sceneId ?? sceneId)
					: sceneId

			if (!targetSceneId) {
				throw new Error('Save succeeded but scene ID is missing. Please retry.')
			}

			if (!sceneId && targetSceneId) {
				navigate(`/publisher/${targetSceneId}`, { replace: true })
			}

			setPublishStatus('publishing')

			const result = await exporterRef.current.exportDocumentGLB(document)
			setOptimizationRuntime((prev) => ({
				...prev,
				optimizedSceneBytes: result.size,
				clientSceneBytes: prev.clientSceneBytes ?? result.size
			}))
			const baseName = file?.name?.replace(/\.[^/.]+$/, '') || 'scene'
			const uploadFormData = new FormData()
			uploadFormData.append('action', 'upload-published-glb')
			uploadFormData.append('sceneId', targetSceneId)
			const glbBytes = new Uint8Array(result.data.byteLength)
			glbBytes.set(result.data)
			uploadFormData.append(
				'file',
				new File([glbBytes], `${baseName}.glb`, {
					type: 'model/gltf-binary'
				})
			)

			const uploadResponse = await fetch(`/api/scenes/${targetSceneId}`, {
				method: 'POST',
				body: uploadFormData
			})

			const uploadResult = await uploadResponse.json()
			if (!uploadResponse.ok || uploadResult.error) {
				throw new Error(
					uploadResult.error || `HTTP error! status: ${uploadResponse.status}`
				)
			}

			const uploadedAsset = uploadResult.data || uploadResult

			const formData = new FormData()
			formData.append('action', 'commit-scene-publish')
			formData.append('sceneId', targetSceneId)
			formData.append('publishedAssetId', uploadedAsset.assetId)
			if (Number.isFinite(result.size)) {
				formData.append('currentSceneBytes', String(result.size))
			}

			const response = await fetch(`/api/scenes/${targetSceneId}`, {
				method: 'POST',
				body: formData
			})

			const resultData = await response.json()
			if (!response.ok || resultData.error) {
				throw new Error(
					resultData.error || `HTTP error! status: ${response.status}`
				)
			}

			const data = (resultData.data || resultData) as PublishSceneResponse
			if (data.stats) {
				setOptimizationRuntime((prev) => ({
					...prev,
					latestSceneStats: data.stats
				}))
			}
			setPublishStatus('success')
			revalidator.revalidate()
			toast.success('Scene published successfully.')
		} catch (error) {
			console.error('Failed to publish scene:', error)
			setPublishStatus('error')
			setPublishError(
				error instanceof Error ? error.message : 'Failed to publish scene'
			)
			toast.error(
				error instanceof Error ? error.message : 'Failed to publish scene'
			)
		}
	}, [
		canPublish,
		optimizer,
		saveSceneSettings,
		sceneId,
		navigate,
		revalidator,
		setOptimizationRuntime,
		file
	])

	const statusText =
		publishStatus === 'saving'
			? 'Saving latest scene changes before publishing...'
			: publishStatus === 'publishing'
				? 'Publishing optimized scene...'
				: publishStatus === 'success'
					? 'Scene published successfully.'
					: publishStatus === 'error'
						? publishError || 'Publishing failed. Retry to continue.'
						: hasUnsavedChanges
							? 'Publish will save your latest changes first.'
							: 'Scene is ready to publish.'

	return (
		<motion.div variants={itemVariants} className="space-y-4 px-2 py-2">
			<div className="text-muted-foreground text-sm">
				Publish your current optimized scene. This action always saves first.
			</div>
			{!sceneId && (
				<div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
					First publish will save and assign a scene ID automatically.
				</div>
			)}

			{publishStatus === 'error' ? (
				<div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-900 dark:text-red-200">
					<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
					<span>{statusText}</span>
				</div>
			) : publishStatus === 'success' ? (
				<div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">
					<CheckCircle className="h-4 w-4 shrink-0" />
					<span>{statusText}</span>
				</div>
			) : (
				<div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
					{statusText}
				</div>
			)}

			<div className="flex items-center rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
				<CheckCircle className="mr-2 h-4 w-4 flex-shrink-0 text-green-500" />
				<p className="text-xs text-green-700 dark:text-green-400">
					Current scene is ready for publication.
				</p>
			</div>

			<div className="flex gap-2">
				<Button
					variant="default"
					className="w-full"
					onClick={handlePublish}
					disabled={isWorking || !canPublish}
				>
					{publishStatus === 'saving' && (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					)}
					{publishStatus === 'publishing' && (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					)}
					{publishStatus === 'saving'
						? 'Saving...'
						: publishStatus === 'publishing'
							? 'Publishing...'
							: publishStatus === 'success'
								? 'Published'
								: 'Publish Scene'}
				</Button>

				{publishStatus === 'error' && (
					<Button
						variant="outline"
						onClick={handlePublish}
						disabled={isWorking || !canPublish}
					>
						<RefreshCcw className="mr-2 h-4 w-4" />
						Retry
					</Button>
				)}
			</div>
		</motion.div>
	)
}
