import { Button } from '@shared/components/ui/button'
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { formatFileSize } from '@shared/utils'
import { motion } from 'framer-motion'
import { useAtomValue } from 'jotai/react'
import { Code, Globe, Save } from 'lucide-react'
import { useState } from 'react'

import { usePublisherSaveAction } from '../../../../hooks/use-publisher-save-action'
import { isSaveActionBlocked } from '../../../../lib/domain/scene'
import { isSavingAtom } from '../../../../lib/stores/publisher-config-store'
import { sidebarContentVariants } from '../animation'
import { DrillDown, DrillDownTrigger, DrillDownView } from '../drill-down'
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
 * The publish sidebar's body: the delivery summary and preview at the top,
 * then the Download, Publish and Embed views. It reads everything from
 * `PublishSidebarContext`; the panel header is `DynamicSidebar`'s.
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
	const [path, setPath] = useState<string[]>([])
	const { handleSaveScene } = usePublisherSaveAction({
		sceneId: sceneId ?? null,
		userId,
		onRequireAuth,
		saveSceneSettings
	})
	const isSaveDisabled = isSaving || isSaveActionBlocked(saveAvailability)

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
				// One column owns the sidebar's gutter and rhythm, so every view
				// lines up with the delivery summary at the top.
				className="p-4"
			>
				<DrillDown
					path={path}
					onPathChange={setPath}
					rootTitle="Scene Info & Publish"
				>
					<DrillDownView id="root" className="space-y-3">
						<DeliverySummary
							sceneBytes={currentSceneBytes}
							sizeReductionPercent={viewModel.sizeReductionPercent}
							sizeDeltaLabel={sizeDeltaLabel}
							onOpenOptimization={onOpenOptimizationDrawer}
						/>

						{canAccessPublishFeatures && <ScenePreview />}

						{/*
						  First in the list because it comes first in the workflow: what
						  ships is decided there, before anything below it matters.
						*/}
						<OptimizationOptions />

						<DrillDownTrigger to="download" icon={<Save />} label="Download" />

						{!isAuthenticated && (
							<div>
								<p className="text-muted-foreground mb-2 text-xs">
									Sign up and save this scene once to unlock Publish and Embed.
								</p>
								<Button
									type="button"
									size="sm"
									className="w-full"
									disabled={isSaveActionBlocked(saveAvailability)}
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
								<DrillDownTrigger
									to="publish"
									icon={<Globe />}
									label="Publish"
									summary={
										publishState.status === 'published' ? 'Published' : 'Draft'
									}
								/>
								{publishState.status === 'published' && (
									<DrillDownTrigger to="embed" icon={<Code />} label="Embed" />
								)}
							</>
						)}
					</DrillDownView>

					<DrillDownView
						id="download"
						title="Download"
						caption="Export the optimized model for use in other applications."
					>
						<SaveOptions />
					</DrillDownView>

					{canAccessPublishFeatures && (
						<DrillDownView id="publish" title="Publish">
							<PublishOptions
								sceneId={sceneId}
								publishState={publishState}
								saveSceneSettings={saveSceneSettings}
							/>
						</DrillDownView>
					)}

					{canAccessPublishFeatures && publishState.status === 'published' && (
						<DrillDownView id="embed" title="Embed">
							<EmbedOptions sceneId={sceneId} projectId={projectId} />
						</DrillDownView>
					)}
				</DrillDown>
			</motion.div>
		</div>
	)
}

export default PublishSidebarContent
