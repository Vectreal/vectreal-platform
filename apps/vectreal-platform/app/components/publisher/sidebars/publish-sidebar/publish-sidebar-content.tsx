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
import { buildSceneMetrics, formatMetricBytes } from './scene-metrics'
import { EmbedOptions } from './sections/embed-options'
import { PublishOptions } from './sections/publish-options'
import { SaveOptions } from './sections/save-options'
import { ScenePreview } from './sections/scene-preview'

import type { ScenePublishStateResponse } from '../../../../types/api'
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

const metricValue = (value?: number | null) =>
	typeof value === 'number' ? value.toLocaleString() : '—'

const getSizeReductionPercent = (
	before?: number | null,
	after?: number | null
) => {
	if (
		typeof before !== 'number' ||
		typeof after !== 'number' ||
		before <= 0 ||
		after > before
	) {
		return null
	}

	return Math.round(((before - after) / before) * 100)
}

const getSizeDeltaBytes = (before?: number | null, after?: number | null) => {
	if (typeof before !== 'number' || typeof after !== 'number') {
		return null
	}

	return before - after
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
		info,
		report,
		publishedAt,
		publishedAssetSizeBytes,
		sizeInfo,
		stats,
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

	const metrics =
		showSceneInfo && info && sizeInfo
			? buildSceneMetrics({
					info,
					report,
					sizeInfo,
					stats
				})
			: null
	const sizeReductionPercent = getSizeReductionPercent(
		metrics?.sceneBytesInitial,
		metrics?.sceneBytesCurrent
	)
	const sizeDeltaBytes = getSizeDeltaBytes(
		metrics?.sceneBytesInitial,
		metrics?.sceneBytesCurrent
	)
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
						<div className="rounded-xl border p-4">
							<div className="mb-3 flex items-center justify-between">
								<p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
									Optimization Metrics
								</p>
								{sizeReductionPercent !== null ? (
									<span className="text-primary bg-primary/15 rounded-full px-2 py-0.5 text-xs font-semibold">
										-{sizeReductionPercent}%
									</span>
								) : null}
							</div>

							<div className="mb-4 rounded-lg border bg-white/40 p-3 dark:bg-black/10">
								<p className="text-muted-foreground mb-2 text-[11px] tracking-wide uppercase">
									Scene Size
								</p>
								<div className="flex items-center justify-between gap-2">
									<p className="text-sm font-semibold">
										{formatMetricBytes(metrics.sceneBytesInitial)}
									</p>
									<ArrowRight className="text-muted-foreground h-3.5 w-3.5" />
									<p className="text-primary text-sm font-semibold">
										{formatMetricBytes(metrics.sceneBytesCurrent)}
									</p>
								</div>
								<p className="text-muted-foreground mt-2 text-xs">
									{sizeDeltaBytes === null
										? 'Size data updates after optimization and save.'
										: sizeDeltaBytes > 0
											? `${formatFileSize(sizeDeltaBytes)} smaller`
											: sizeDeltaBytes < 0
												? `${formatFileSize(Math.abs(sizeDeltaBytes))} larger`
												: 'No size change'}
								</p>
							</div>

							<div className="grid grid-cols-2 gap-3 text-xs">
								<div>
									<p className="text-muted-foreground">Triangles</p>
									<p className="font-medium">
										{metricValue(metrics.triangleInitial)} →{' '}
										{metricValue(metrics.triangleOptimized)}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Texture Size</p>
									<p className="font-medium">
										{formatMetricBytes(metrics.textureSizeInitial)} →{' '}
										{formatMetricBytes(metrics.textureSizeOptimized)}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Published Asset</p>
									<p className="font-medium">
										{publishedAssetSizeBytes
											? formatFileSize(publishedAssetSizeBytes)
											: '—'}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Published At</p>
									<p className="font-medium">
										{formatPublishedAt(publishedAt)}
									</p>
								</div>
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

					{canAccessPublishFeatures && canReoptimize && (
						<div className="px-6 pb-2">
							<p className="text-muted-foreground mb-2 text-xs">
								Need another pass? Re-optimize your saved scene before
								publishing.
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

							{publishedAt && (
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
			</motion.div>
		</div>
	)
}

export default PublishSidebarContent
