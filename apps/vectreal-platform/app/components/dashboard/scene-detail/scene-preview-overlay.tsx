import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { Eye } from 'lucide-react'
import { Link } from 'react-router'

import type { ScenePublishStateResponse } from '../../../types/api'

interface ScenePreviewOverlayProps {
	previewPath: string
	publishState: Pick<ScenePublishStateResponse, 'status'>
}

const OVERLAY_SURFACE = 'bg-background/80 backdrop-blur-sm'

/**
 * See it the way a visitor will, on the thing that is showing it to you.
 *
 * Preview was a filled button in the metadata panel below - the last survivor of
 * a stack of four - and once publishing took the top of the column it was the
 * only control left down there, dressed as the page's primary action while the
 * primary action had moved. It is not that: the viewer beside it already shows
 * the scene, and this opens the chrome-free page a visitor gets.
 *
 * So it sits on the viewer, which is the thing it is a different view of.
 *
 * `z-10`, a plain number: this orders two siblings inside one component's own
 * stacking context and claims no relationship with the site chrome, which is
 * what the named tiers are for.
 *
 * Translucent with a blur rather than solid, because it floats over a model
 * whose colour is the user's, not ours - and a solid chip would be a hole
 * punched in their scene.
 */
export function ScenePreviewOverlay({
	previewPath,
	publishState
}: ScenePreviewOverlayProps) {
	return (
		<>
			{/*
			  Which scene the viewer is showing, because the two now differ: a
			  published scene renders the artefact that ships, a draft renders the
			  working scene. Not "Published version": the presentation settings are
			  read live, not snapshotted at publish, so what this shows is what a
			  visitor would see right now.
			*/}
			<p
				className={cn(
					OVERLAY_SURFACE,
					'text-muted-foreground pointer-events-none absolute top-3 left-3 z-10 rounded-md px-2 py-1 text-xs'
				)}
			>
				{publishState.status === 'published' ? 'What visitors see' : 'Draft'}
			</p>
			<Button
				variant="secondary"
				size="sm"
				asChild
				className={cn(
					OVERLAY_SURFACE,
					'hover:bg-background/90 absolute top-3 right-3 z-10'
				)}
			>
				<Link viewTransition to={previewPath}>
					<Eye className="mr-2 h-4 w-4 shrink-0" />
					Preview
				</Link>
			</Button>
		</>
	)
}
