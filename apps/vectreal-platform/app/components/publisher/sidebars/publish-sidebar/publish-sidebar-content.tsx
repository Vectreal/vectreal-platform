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
import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import { motion } from 'framer-motion'
import { useAtomValue } from 'jotai'
import { Code, Globe, Save } from 'lucide-react'

import { SaveAvailabilityState, SaveSceneFn } from '../../../../hooks'
import { usePublisherSaveAction } from '../../../../hooks/use-publisher-save-action'
import { processAtom } from '../../../../lib/stores/publisher-config-store'
import { AccordionItem, AccordionTrigger } from '../accordion-components'
import { sidebarContentVariants } from '../animation'
import {
	buildSceneMetrics,
	formatMetricBytes,
	formatMetricCount
} from './scene-metrics'
import { EmbedOptions } from './sections/embed-options'
import { PublishOptions } from './sections/publish-options'
import { SaveOptions } from './sections/save-options'
import { ScenePreview } from './sections/scene-preview'

import type {
	ScenePublishStateResponse,
	SceneStatsData
} from '../../../../types/api'
import type { OptimizationReport } from '@vctrl/core'
import type { FC } from 'react'

interface PublishSidebarContentProps {
	sceneId?: string
	projectId?: string
	userId?: string
	hideHeader?: boolean
	showSceneInfo?: boolean
	info?: OptimizationInfo
	report?: OptimizationReport | null
	publishedAt?: string | null
	publishedAssetSizeBytes?: number | null
	sizeInfo?: {
		initialSceneBytes?: number | null
		currentSceneBytes?: number | null
		initialTextureBytes?: number | null
		currentTextureBytes?: number | null
	}
	stats?: SceneStatsData | null
	saveAvailability?: SaveAvailabilityState
	onRequireAuth?: () => Promise<void> | void
	saveSceneSettings: SaveSceneFn
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

const metricValue = (value?: number | null) =>
	typeof value === 'number' ? value.toLocaleString() : '—'

const PublishSidebarContent: FC<PublishSidebarContentProps> = ({
	sceneId,
	projectId,
	userId,
	hideHeader = false,
	showSceneInfo = false,
	info,
	report,
	publishedAt,
	publishedAssetSizeBytes,
	sizeInfo,
	stats,
	saveAvailability,
	onRequireAuth,
	saveSceneSettings
}) => {
	const { isSaving } = useAtomValue(processAtom)
	const { handleSaveScene } = usePublisherSaveAction({
		sceneId: sceneId ?? null,
		userId,
		onRequireAuth,
		saveSceneSettings
	})
	const isSaveDisabled = userId
		? isSaving || !saveAvailability?.canSave
		: isSaving

	const metrics =
		showSceneInfo && info && sizeInfo
			? buildSceneMetrics({
					info,
					report,
					sizeInfo,
					stats
				})
			: null
	const isAuthenticated = Boolean(userId)
	const hasSavedScene = Boolean(
		typeof sceneId === 'string' && sceneId.length > 0
	)
	const canAccessPublishFeatures = isAuthenticated && hasSavedScene
	const publishState: ScenePublishStateResponse = {
		sceneId: sceneId ?? '',
		status: publishedAt ? 'published' : 'draft',
		publishedAt: publishedAt ?? null,
		publishedAssetId: null,
		publishedAssetSizeBytes: publishedAssetSizeBytes ?? null
	}

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
					<div className="px-4 pt-4">
						<div className="bg-muted/40 space-y-3 rounded-lg p-3">
							<div className="grid grid-cols-2 gap-3 text-xs">
								<div>
									<p className="text-muted-foreground">Triangles</p>
									<p className="font-medium">
										{metricValue(metrics.triangleInitial)} →{' '}
										{metricValue(metrics.triangleOptimized)}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Texture Count</p>
									<p className="font-medium">
										{formatMetricCount(metrics.textureCountInitial)} →{' '}
										{formatMetricCount(metrics.textureCountOptimized)}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Scene Size</p>
									<p className="font-medium">
										{formatMetricBytes(metrics.sceneBytesInitial)} →{' '}
										{formatMetricBytes(metrics.sceneBytesCurrent)}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Current Scene Size</p>
									<p className="font-medium">
										{typeof metrics.sceneBytesCurrent === 'number'
											? formatFileSize(metrics.sceneBytesCurrent)
											: '—'}
									</p>
								</div>
							</div>
							<Separator />
							<div className="text-xs">
								<p className="text-muted-foreground">Published At</p>
								<p className="font-medium">{formatPublishedAt(publishedAt)}</p>
							</div>
						</div>
					</div>
				)}

				{canAccessPublishFeatures && <ScenePreview />}

				<Accordion type="single" collapsible className="space-y-2 px-4 pt-4">
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
						</>
					)}
				</Accordion>
			</motion.div>
		</div>
	)
}

export default PublishSidebarContent
