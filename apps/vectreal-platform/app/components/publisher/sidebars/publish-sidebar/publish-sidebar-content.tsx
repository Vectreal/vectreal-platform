import { Accordion, AccordionContent } from '@shared/components/ui/accordion'
import { Button } from '@shared/components/ui/button'
import {
	CardDescription,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { Separator } from '@shared/components/ui/separator'
import { formatFileSize } from '@shared/utils'
import { motion } from 'framer-motion'
import { useAtomValue } from 'jotai/react'
import { ArrowRight, Code, Globe, Save, Sparkles } from 'lucide-react'

import { usePublisherSaveAction } from '../../../../hooks/use-publisher-save-action'
import { isSavingAtom } from '../../../../lib/stores/publisher-config-store'
import { AccordionItem, AccordionTrigger } from '../accordion-components'
import { sidebarContentVariants } from '../animation'
import { usePublishSidebarContext } from './publish-sidebar-context'
import { FileSizeComparison } from '../file-size-comparison'
import { EmbedOptions } from './sections/embed-options'
import { PublishOptions } from './sections/publish-options'
import { SaveOptions } from './sections/save-options'
import { ScenePreview } from './sections/scene-preview'

import type { FC } from 'react'

interface PublishSidebarContentProps {
	hideHeader?: boolean
	showSceneInfo?: boolean
}

const formatPublishedAt = (value?: string | null) => {
	if (!value) {
		return 'Not published yet'
	}

	const date = new Date(value)
	if (Number.isNaN(date.getTime())) {
		return 'Not published yet'
	}

	return date.toLocaleString()
}

const metricValue = (value?: number | null, isLoading = false) => {
	if (typeof value === 'number') {
		return value.toLocaleString()
	}

	return isLoading ? 'Loading...' : '—'
}

const metricBytesValue = (value?: number | null, isLoading = false) => {
	if (typeof value === 'number') {
		return formatFileSize(value)
	}

	return isLoading ? 'Loading...' : '—'
}

const getSizeDeltaLabel = (deltaBytes?: number | null) => {
	if (typeof deltaBytes !== 'number') {
		return null
	}

	if (deltaBytes > 0) {
		return `${formatFileSize(deltaBytes)} smaller`
	}

	if (deltaBytes < 0) {
		return `${formatFileSize(Math.abs(deltaBytes))} larger`
	}

	return 'No size change'
}

const PublishSidebarContent: FC<PublishSidebarContentProps> = ({
	hideHeader = false,
	showSceneInfo = false
}) => {
	const {
		sceneId,
		projectId,
		userId,
		onOpenOptimizationModal,
		canReoptimize,
		viewModel,
		saveAvailability,
		onRequireAuth,
		saveSceneSettings
	} = usePublishSidebarContext()
	const isSaving = useAtomValue(isSavingAtom)
	const { handleSaveScene } = usePublisherSaveAction({
		sceneId: sceneId ?? null,
		userId,
		onRequireAuth,
		saveSceneSettings
	})
	const isSaveDisabled = userId
		? isSaving || !saveAvailability?.canSave
		: isSaving

	const metrics = showSceneInfo ? viewModel.metrics : null
	const sizeReductionPercent = showSceneInfo
		? viewModel.sizeReductionPercent
		: null
	const sizeDeltaBytes = showSceneInfo ? viewModel.sizeDeltaBytes : null
	const sizeDeltaLabel = getSizeDeltaLabel(sizeDeltaBytes)
	const isHydratingInitialMetrics = viewModel.isHydratingInitialMetrics
	const publishMetricSizeInfo = viewModel.publishMetricSizeInfo
	const isAuthenticated = viewModel.isAuthenticated
	const hasSavedScene = viewModel.hasSavedScene
	const canAccessPublishFeatures = viewModel.canAccessPublishFeatures
	const publishState = viewModel.publishState
	const publishedAt = publishState.publishedAt
	const publishedAssetSizeBytes = publishState.publishedAssetSizeBytes

	return (
		<div className="no-scrollbar grow overflow-auto pb-2">
			<motion.div
				variants={sidebarContentVariants}
				initial="initial"
				animate="animate"
				exit="exit"
				key="publish-sidebar"
				className="overflow-auto"
			>
				{!hideHeader && (
					<>
						<CardHeader className="py-6">
							<CardTitle>Publish Your Scene</CardTitle>
							<CardDescription>
								Save, publish, and share your 3D scene with the world
							</CardDescription>
						</CardHeader>

						<Separator />
					</>
				)}

				{metrics && (
					<div className="p-4">
						<div className="mb-3 flex items-center justify-between">
							<p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
								Optimization Metrics
							</p>
							{sizeReductionPercent !== null && sizeDeltaLabel ? (
								<span className="text-primary bg-primary/15 rounded-full px-2 py-0.5 text-xs font-semibold">
									-{sizeReductionPercent}% • {sizeDeltaLabel}
								</span>
							) : null}
						</div>

						<FileSizeComparison sizeInfo={publishMetricSizeInfo} />

						<div className="bg-muted/50 space-y-3 rounded-lg p-4 text-xs">
							<div className="flex items-center justify-between gap-3">
								<p className="text-muted-foreground">Triangles</p>
								<p className="font-medium">
									{metricValue(
										metrics.primitives.initial,
										isHydratingInitialMetrics
									)}{' '}
									<ArrowRight className="text-muted-foreground mx-1 inline h-3 w-3" />
									{metricValue(metrics.primitives.current)}
								</p>
							</div>
							<div className="flex items-center justify-between gap-3">
								<p className="text-muted-foreground">Texture Size</p>
								<p className="font-medium">
									{metricBytesValue(
										metrics.textureBytes.initial,
										isHydratingInitialMetrics
									)}{' '}
									<ArrowRight className="text-muted-foreground mx-1 inline h-3 w-3" />
									{metricBytesValue(metrics.textureBytes.current)}
								</p>
							</div>
							<div className="flex items-center justify-between gap-3">
								<p className="text-muted-foreground">Published At</p>
								<p className="font-medium">{formatPublishedAt(publishedAt)}</p>
							</div>
							<div className="flex items-center justify-between gap-3">
								<p className="text-muted-foreground">Published Asset</p>
								<p className="font-medium">
									{publishedAssetSizeBytes
										? formatFileSize(publishedAssetSizeBytes)
										: '—'}
								</p>
							</div>
						</div>
					</div>
				)}

				{canAccessPublishFeatures && <ScenePreview />}

				<Accordion type="single" collapsible className="space-y-2 p-4">
					<AccordionItem value="save" className="px-4">
						<AccordionTrigger className="px-2">
							<span className="flex items-center gap-3">
								<Save className="inline" size={14} />
								Download
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<SaveOptions />
						</AccordionContent>
					</AccordionItem>

					{!isAuthenticated && (
						<div className="px-6 pb-2">
							<p className="text-muted-foreground mb-2 text-xs">
								Sign up and save this scene once to unlock Publish and Embed.
							</p>
							<Button
								type="button"
								size="sm"
								className="w-full"
								onClick={() => void onRequireAuth?.()}
							>
								Sign In or Sign Up to Save
							</Button>
						</div>
					)}

					{!hasSavedScene && isAuthenticated && (
						<div className="my-4 pb-2">
							<p className="text-muted-foreground mb-2 text-xs">
								Save this scene once to unlock Publish and Embed.
							</p>
							<Button
								type="button"
								size="sm"
								className="w-full"
								disabled={isSaveDisabled}
								onClick={() => void handleSaveScene()}
							>
								{isSaving ? (
									<>
										<LoadingSpinner />
										Saving...
									</>
								) : (
									'Save Scene'
								)}
							</Button>
						</div>
					)}

					{isSaveDisabled &&
						saveAvailability?.reason === 'requires-first-optimization' && (
							<div className="my-4 pb-2">
								<p className="text-muted-foreground mb-2 text-xs">
									Optimize your scene first to enable saving and publishing
									features.
								</p>
							</div>
						)}

					{canAccessPublishFeatures && (
						<>
							<AccordionItem value="publish" className="px-4">
								<AccordionTrigger className="px-2">
									<span className="flex items-center gap-3">
										<Globe className="inline" size={14} />
										Publish
									</span>
								</AccordionTrigger>
								<AccordionContent>
									<PublishOptions
										sceneId={sceneId}
										publishState={publishState}
										saveSceneSettings={saveSceneSettings}
									/>
								</AccordionContent>
							</AccordionItem>

							{publishState.status === 'published' && (
								<AccordionItem value="embed" className="px-4">
									<AccordionTrigger className="px-2">
										<span className="flex items-center gap-3">
											<Code className="inline" size={14} />
											Embed
										</span>
									</AccordionTrigger>
									<AccordionContent>
										<EmbedOptions sceneId={sceneId} projectId={projectId} />
									</AccordionContent>
								</AccordionItem>
							)}
						</>
					)}
				</Accordion>

				{canAccessPublishFeatures && canReoptimize && (
					<div className="space-y-3 p-4">
						<p className="text-muted-foreground text-xs">
							Need another pass? Re-optimize your saved scene before publishing.
						</p>
						<Button
							type="button"
							size="sm"
							variant="secondary"
							className="w-full"
							onClick={() => onOpenOptimizationModal?.()}
						>
							<Sparkles size={14} className="mr-2" />
							Re-optimize Scene
						</Button>
					</div>
				)}
			</motion.div>
		</div>
	)
}

export default PublishSidebarContent
