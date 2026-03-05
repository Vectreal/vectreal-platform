import { Accordion, AccordionContent } from '@shared/components/ui/accordion'
import { Button } from '@shared/components/ui/button'
import {
	CardDescription,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
import { Separator } from '@shared/components/ui/separator'
import { formatFileSize } from '@shared/utils'
import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import { motion } from 'framer-motion'
import { Code, Globe, Save } from 'lucide-react'

import { AccordionItem, AccordionTrigger } from '../accordion-components'
import { sidebarContentVariants } from '../animation'
import {
	buildSceneMetrics,
	formatMetricBytes,
	formatMetricCount
} from '../optimize-sidebar/scene-metrics'
import { EmbedOptions } from './sections/embed-options'
import { PublishOptions } from './sections/publish-options'
import { SaveOptions } from './sections/save-options'
import { ScenePreview } from './sections/scene-preview'

import type { SceneStatsData } from '../../../../types/api'
import type { OptimizationReport } from '@vctrl/core'
import type { FC } from 'react'

interface PublishSidebarProps {
	sceneId?: string
	projectId?: string
	userId?: string
	hideHeader?: boolean
	showSceneInfo?: boolean
	info?: OptimizationInfo
	report?: OptimizationReport | null
	publishedAt?: string | null
	sizeInfo?: {
		initialSceneBytes?: number | null
		currentSceneBytes?: number | null
		initialTextureBytes?: number | null
		currentTextureBytes?: number | null
	}
	stats?: SceneStatsData | null
	onRequireAuth?: () => Promise<void> | void
	saveSceneSettings: () => Promise<
		| { sceneId?: string; unchanged?: boolean; [key: string]: unknown }
		| { unchanged: true }
		| undefined
	>
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

const PublishSidebarContent: FC<PublishSidebarProps> = ({
	sceneId,
	projectId,
	userId,
	hideHeader = false,
	showSceneInfo = false,
	info,
	report,
	publishedAt,
	sizeInfo,
	stats,
	onRequireAuth,
	saveSceneSettings
}) => {
	const metrics =
		showSceneInfo && info && sizeInfo
			? buildSceneMetrics({
					info,
					report,
					sizeInfo,
					stats
				})
			: null
	const hasSavedScene = typeof sceneId === 'string' && sceneId.length > 0
	const canAccessPublishFeatures = Boolean(userId && hasSavedScene)

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
								Save & Export
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<SaveOptions />
						</AccordionContent>
					</AccordionItem>

					{!canAccessPublishFeatures && (
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

					{/* <AccordionItem value="share" className="px-4">
						<AccordionTrigger className="px-2">
							<span className="flex items-center gap-3">
								<Share2 className="inline" size={14} />
								Share
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<ShareOptions />
						</AccordionContent>
					</AccordionItem> */}
				</Accordion>
			</motion.div>
		</div>
	)
}

export default PublishSidebarContent
