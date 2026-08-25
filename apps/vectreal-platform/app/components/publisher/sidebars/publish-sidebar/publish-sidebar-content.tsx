import { Accordion, AccordionContent } from '@shared/components/ui/accordion'
import { Button } from '@shared/components/ui/button'
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
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

/**
 * The publish sidebar's body. It takes no props.
 *
 * It had two booleans, `hideHeader` and `showSceneInfo`, and its one consumer
 * always passed both, so neither could ever be false and every branch reading
 * them was unreachable. `hideHeader` guarded a second panel header that
 * `DynamicSidebar` already renders for the desktop panel and the mobile sheet
 * alike; `showSceneInfo` guarded the delivery summary and the two size figures
 * it needs.
 *
 * A prop with one caller and one value is not configuration - it is a claim
 * that the component supports a mode nobody has ever rendered, which someone
 * eventually has to read the whole tree to disprove.
 */

const PublishSidebarContent: FC = () => {
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

	const sizeDeltaLabel = getSizeDeltaLabel(viewModel.sizeDeltaBytes)
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
				{/*
				  One column owns the sidebar's gutter and rhythm. The sections used
				  to each carry their own padding, which had drifted to six different
				  vertical values and two different left edges, so the top half of the
				  sidebar did not line up with the accordion below it.
				*/}
				<div className="flex flex-col gap-3 p-4">
					<DeliverySummary
						sceneBytes={currentSceneBytes}
						sizeReductionPercent={viewModel.sizeReductionPercent}
						sizeDeltaLabel={sizeDeltaLabel}
						onOpenOptimization={onOpenOptimizationDrawer}
					/>

					{canAccessPublishFeatures && <ScenePreview />}

					<Accordion type="single" collapsible className="flex flex-col gap-3">
						{/*
						  First in the list because it comes first in the workflow: what
						  ships is decided here, before anything below it matters.
						*/}
						<AccordionItem value="optimize">
							<AccordionTrigger>
								<Sparkles />
								Optimization
							</AccordionTrigger>
							<AccordionContent>
								<OptimizationOptions />
							</AccordionContent>
						</AccordionItem>

						<AccordionItem value="save">
							<AccordionTrigger>
								<Save />
								Download
							</AccordionTrigger>
							<AccordionContent>
								<SaveOptions />
							</AccordionContent>
						</AccordionItem>

						{!isAuthenticated && (
							<div>
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
							<div>
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
								<p className="text-muted-foreground text-xs">
									This scene is over your plan's max scene size. Optimize to
									reduce it below the limit to enable saving and publishing.
								</p>
							)}

						{canAccessPublishFeatures && (
							<>
								<AccordionItem value="publish">
									<AccordionTrigger>
										<Globe />
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
											<Code />
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
				</div>
			</motion.div>
		</div>
	)
}

export default PublishSidebarContent
