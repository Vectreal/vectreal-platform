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
export function ScenePreviewOverlay({ previewPath }: ScenePreviewOverlayProps) {
	return (
		<Button
			variant="secondary"
			size="sm"
			asChild
			className="bg-background/80 hover:bg-background/90 absolute top-3 right-3 z-10 backdrop-blur-sm"
		>
			<Link viewTransition to={previewPath}>
				<Eye className="mr-2 h-4 w-4 shrink-0" />
				Preview
			</Link>
		</Button>
	)
}
