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
import { Code, Globe, Save, Sparkles } from 'lucide-react'

import { usePublisherSaveAction } from '../../../../hooks/use-publisher-save-action'
import { isSavingAtom } from '../../../../lib/stores/publisher-config-store'
import { AccordionItem, AccordionTrigger } from '../accordion-components'
import { sidebarContentVariants } from '../animation'
import { usePublishSidebarContext } from './publish-sidebar-context'
import { DeliverySummary } from './sections/delivery-summary'
import { EmbedOptions } from './sections/embed-options'
import { OptimizationOptions } from './sections/optimization-options'
import { PublishOptions } from './sections/publish-options'
import { SaveOptions } from './sections/save-options'
import { ScenePreview } from './sections/scene-preview'

import type { FC } from 'react'

interface PublishSidebarContentProps {
	hideHeader?: boolean
	showSceneInfo?: boolean
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
		onOpenOptimizationDrawer,
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

	const sizeReductionPercent = showSceneInfo
		? viewModel.sizeReductionPercent
		: null
	const sizeDeltaBytes = showSceneInfo ? viewModel.sizeDeltaBytes : null
	const sizeDeltaLabel = getSizeDeltaLabel(sizeDeltaBytes)
	const currentSceneBytes = viewModel.publishMetricSizeInfo.currentSceneBytes
	const isAuthenticated = viewModel.isAuthenticated
	const hasSavedScene = viewModel.hasSavedScene
	const canAccessPublishFeatures = viewModel.canAccessPublishFeatures
	const publishState = viewModel.publishState

	return (
		<div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-2">
			<motion.div
				variants={sidebarContentVariants}
				initial="initial"
				animate="animate"
				exit="exit"
				key="publish-sidebar"
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

				{showSceneInfo && (
					<DeliverySummary
						sceneBytes={currentSceneBytes}
						sizeReductionPercent={sizeReductionPercent}
						sizeDeltaLabel={sizeDeltaLabel}
						onOpenOptimization={onOpenOptimizationDrawer}
					/>
				)}

				{canAccessPublishFeatures && <ScenePreview />}

				<Accordion type="single" collapsible className="space-y-2 p-4">
					{/*
					  First in the list because it comes first in the workflow: what
					  ships is decided here, before anything below it matters.
					*/}
					<AccordionItem value="optimize">
						<AccordionTrigger>
							<Sparkles className="inline" size={14} />
							Optimization
						</AccordionTrigger>
						<AccordionContent>
							<OptimizationOptions />
						</AccordionContent>
					</AccordionItem>

					<AccordionItem value="save">
						<AccordionTrigger>
							<Save className="inline" size={14} />
							Download
						</AccordionTrigger>
						<AccordionContent>
							<SaveOptions />
						</AccordionContent>
					</AccordionItem>

					{!isAuthenticated && (
						<div className="px-4 pb-3">
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
						saveAvailability?.reason === 'requires-size-reduction' && (
							<div className="my-4 pb-2">
								<p className="text-muted-foreground mb-2 text-xs">
									This scene is over your plan's max scene size. Optimize to
									reduce it below the limit to enable saving and publishing.
								</p>
							</div>
						)}

					{canAccessPublishFeatures && (
						<>
							<AccordionItem value="publish">
								<AccordionTrigger>
									<Globe className="inline" size={14} />
									Publish
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
								<AccordionItem value="embed">
									<AccordionTrigger>
										<Code className="inline" size={14} />
										Embed
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
