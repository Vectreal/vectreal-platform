import { Button } from '@shared/components/ui/button'
import { Eye, Rocket } from 'lucide-react'
import { Link } from 'react-router'

interface SceneHeaderActionsProps {
	previewPath: string
	publisherPath: string
}

/**
 * The two things this page is for.
 *
 * Exactly two, and both are navigations. There were four stacked here - these,
 * plus Publish & Embed and an overflow menu - which is three too many for one
 * surface and set the header's height while the title beside it was two lines,
 * leaving a void under the description.
 *
 * Publish & Embed became a `SceneTriggerCard` in the facts panel, where it can
 * say what state it leads to. Delete became `SceneOverflowMenu`, an icon in the
 * panel's corner.
 *
 * A row rather than a column now that there are two: stacking existed so the
 * icons would line up as a column, which is not a problem two side-by-side
 * buttons have. Full width and stacked below `sm`, where a row would wrap
 * anyway.
 */
export function SceneHeaderActions({
	previewPath,
	publisherPath
}: SceneHeaderActionsProps) {
	return (
		<div className="flex flex-col gap-2 sm:flex-row">
			<Button asChild className="max-sm:w-full max-sm:justify-start">
				<Link viewTransition to={previewPath}>
					<Eye className="mr-2 h-4 w-4 shrink-0" />
					Preview
				</Link>
			</Button>

			<Button
				variant="secondary"
				asChild
				className="max-sm:w-full max-sm:justify-start"
			>
				<Link viewTransition to={publisherPath}>
					<Rocket className="mr-2 h-4 w-4 shrink-0" />
					Open in Publisher
				</Link>
			</Button>
		</div>
	)
}
