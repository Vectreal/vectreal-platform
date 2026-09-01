import { SceneSurfaceDrawer } from './scene-surface-drawer'
import { EmbedOptionsPanel } from '../../embed/embed-options-panel'
import { DetailPanelSection } from '../../layout-components'
import { ScenePublishStateControl } from '../../publishing/scene-publish-state-control'

import type { ScenePublishStateResponse } from '../../../types/api'

interface SceneShareDrawerProps {
	sceneId: string
	projectId: string
	publishState: ScenePublishStateResponse
	/** Publishing happens in the publisher; this navigates there. */
	onPublish: () => void
	className?: string
}

/**
 * What the door says before it is opened.
 *
 * The date only, not a time: this is one line on a card, and the drawer behind
 * it renders the full timestamp.
 */
function describePublishState(publishState: ScenePublishStateResponse): string {
	if (publishState.status !== 'published') {
		return 'Draft · not published yet'
	}

	const publishedAt = publishState.publishedAt
		? new Date(publishState.publishedAt)
		: null

	if (!publishedAt || Number.isNaN(publishedAt.getTime())) {
		return 'Published'
	}

	return `Published · ${publishedAt.toLocaleDateString()}`
}

/**
 * What you *do* with the scene: publish it, and put it on someone else's site.
 *
 * A door rather than a call to action. This was a `Button` in the header's
 * action stack, which put it beside Preview and Open in Publisher as though it
 * were a third navigation, made four controls out of two, and said nothing
 * about the state it leads to.
 *
 * It opens from the same edge as the scene details surface at any given width,
 * because both are `SceneSurfaceDrawer` - see there for why the direction
 * follows the layout rather than the surface.
 */
export function SceneShareDrawer({
	sceneId,
	projectId,
	publishState,
	onPublish,
	className
}: SceneShareDrawerProps) {
	const isPublished = publishState.status === 'published'

	return (
		<SceneSurfaceDrawer
			label="Publish & Embed"
			summary={describePublishState(publishState)}
			description="Publication state, access, and the snippet for this scene."
			triggerClassName={className}
		>
			<DetailPanelSection title="Publishing">
				<ScenePublishStateControl
					publishState={publishState}
					onPublish={onPublish}
					draftActionMode="immediate"
					publishButtonText="Open Publisher to Publish"
					publishDisabledReason="Publishing is managed in the Publisher workflow to ensure optimized output and texture consistency."
					revokeDialogTitle="Revoke scene publication?"
					revokeDialogDescription="This deletes the published GLB asset and returns this scene to draft state."
				/>
			</DetailPanelSection>

			{/*
			  Untitled on purpose. `EmbedOptionsPanel` titles itself - Access and
			  Embed Code - and a wrapper title was a third label for the same block.
			  Worse, both rungs are `h4`, so the outline read `h4 Embed / h4 Access /
			  h4 Embed Code`: the parts announced as peers of their own container.
			  The wrapper stays for the spacing it carries.

			  Gated on publication, matching the publisher, whose Embed accordion
			  item only exists once the scene is published. The drawer itself is not
			  gated: a trigger that disappears is a worse empty state than a surface
			  that explains itself.
			*/}
			{isPublished && (
				<DetailPanelSection className="pt-1">
					<EmbedOptionsPanel sceneId={sceneId} projectId={projectId} />
				</DetailPanelSection>
			)}
		</SceneSurfaceDrawer>
	)
}
