import { Button } from '@shared/components/ui/button'
import { Eye } from 'lucide-react'
import { Link } from 'react-router'

interface ScenePreviewOverlayProps {
	previewPath: string
}

/**
 * See it the way a visitor will, on the thing that is showing it to you.
 *
 * Preview was a filled button in the metadata panel below - the last survivor of
 * a stack of four - and once publishing took the top of the column it was the
 * only control left down there, dressed as the page's primary action while the
 * primary action had moved. It is not that: the viewer beside it already shows
 * the scene, and this opens the chrome-free page a visitor gets.
 *
 * So it sits on the viewer, which is the thing it is a different view of, in
 * the top-right: the one corner the viewer never draws in. Its camera switcher
 * sits bottom centre, playback bottom right, and "Back to scene view" top
 * centre after a hotspot is opened. Below `sm` it drops to its icon, which
 * keeps it clear of that way back.
 *
 * `z-10`, a plain number: it only lifts the button over the viewer it shares a
 * section with, and claims no relationship with the site chrome, which is what
 * the named tiers are for.
 *
 * Translucent with a blur rather than solid, because it floats over a model
 * whose colour is the user's, not ours - and a solid chip would be a hole
 * punched in their scene.
 */
export function ScenePreviewOverlay({ previewPath }: ScenePreviewOverlayProps) {
	return (
		<Button
			variant="secondary"
			size="sm"
			asChild
			className="bg-background/80 hover:bg-background/90 absolute top-3 right-3 z-10 backdrop-blur-sm"
		>
			<Link viewTransition to={previewPath}>
				<Eye className="h-4 w-4 shrink-0 sm:mr-2" />
				{/* Still the link's name below `sm`, where only the icon shows. */}
				<span className="sr-only sm:not-sr-only">Preview</span>
			</Link>
		</Button>
	)
}
