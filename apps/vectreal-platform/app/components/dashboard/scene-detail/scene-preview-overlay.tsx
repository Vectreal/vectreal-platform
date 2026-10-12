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
 * Top-right, and the label beneath it, because that corner is the one the
 * viewer never draws in. Its camera switcher sits bottom centre, playback
 * bottom right, and "Back to scene view" top centre after a hotspot is opened.
 * Bottom-left is free here, since this page passes the viewer no info
 * popover, but not wide enough: the label sat there until the camera switcher
 * moved into the viewer, and on a phone the switcher ran straight over it. It
 * reserves 5rem per side for the viewer's own icon-sized controls, and "What
 * visitors see" is wider than that. Below `sm` Preview also drops to its icon,
 * which keeps it clear of the way back from a hotspot.
 *
 * `z-10`, a plain number: it only lifts this column over the viewer it shares
 * a section with, and claims no relationship with the site chrome, which is
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
		/*
		  Click-through except for the link: the column is as wide as the label,
		  so below `sm` it spans empty space beside the icon where a drag should
		  still reach the model.
		*/
		<div className="pointer-events-none absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
			<Button
				variant="secondary"
				size="sm"
				asChild
				className={cn(
					OVERLAY_SURFACE,
					'hover:bg-background/90 pointer-events-auto'
				)}
			>
				<Link viewTransition to={previewPath}>
					<Eye className="h-4 w-4 shrink-0 sm:mr-2" />
					{/* Still the link's name below `sm`, where only the icon shows. */}
					<span className="sr-only sm:not-sr-only">Preview</span>
				</Link>
			</Button>
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
					'text-foreground rounded-md px-2 py-1 text-xs'
				)}
			>
				<span className="sr-only">Viewer showing: </span>
				{publishState.status === 'published' ? 'What visitors see' : 'Draft'}
			</p>
		</div>
	)
}
