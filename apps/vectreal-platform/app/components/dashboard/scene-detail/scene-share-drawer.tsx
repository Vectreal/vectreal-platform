import { Button } from '@shared/components/ui/button'
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger
} from '@shared/components/ui/drawer'
import { Share2 } from 'lucide-react'

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
}

/**
 * What you *do* with the scene: publish it, and put it on someone else's site.
 *
 * The second of the page's two surfaces, and the only one behind an overlay.
 * Its trigger lives here rather than in the header that renders it, so the
 * primitive owns the open state and the focus return - a controlled `open` with
 * a plain button elsewhere would make both this component's problem, and the
 * page had three separate buttons opening one drawer precisely because nothing
 * owned that relationship.
 *
 * `max-w-detail-panel!` is the width `EmbedOptionsPanel` needs; the facts panel
 * beside it reads the same token.
 */
export function SceneShareDrawer({
	sceneId,
	projectId,
	publishState,
	onPublish
}: SceneShareDrawerProps) {
	const isPublished = publishState.status === 'published'

	return (
		<Drawer direction="right">
			<DrawerTrigger asChild>
				<Button variant="secondary" className="w-full justify-start">
					<Share2 className="mr-2 h-4 w-4 shrink-0" />
					Publish &amp; Embed
				</Button>
			</DrawerTrigger>

			{/*
			  The `p-6` body matches `DrawerHeader`, which is `p-6`: a tighter body
			  puts the heading and the content beneath it on different left edges -
			  the misalignment `drawer.tsx` records having already fixed once.
			*/}
			<DrawerContent className="max-w-detail-panel! border-0">
				<DrawerHeader>
					<DrawerTitle>Publish &amp; Embed</DrawerTitle>
					<DrawerDescription>
						Publication state, access, and the snippet for this scene.
					</DrawerDescription>
				</DrawerHeader>

				<div className="space-y-6 overflow-y-auto p-6">
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
					  Embed Code - and a wrapper title was a third label for the same
					  block. Worse, both rungs are `h4`, so the outline read
					  `h4 Embed / h4 Access / h4 Embed Code`: the parts announced as peers
					  of their own container. The wrapper stays for the spacing it carries.

					  Gated on publication, matching the publisher, whose Embed accordion
					  item only exists once the scene is published. The drawer itself is
					  not gated: a trigger that disappears is a worse empty state than a
					  surface that explains itself.
					*/}
					{isPublished && (
						<DetailPanelSection className="pt-1">
							<EmbedOptionsPanel sceneId={sceneId} projectId={projectId} />
						</DetailPanelSection>
					)}
				</div>
			</DrawerContent>
		</Drawer>
	)
}
