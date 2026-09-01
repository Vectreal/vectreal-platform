import { Button } from '@shared/components/ui/button'
import { Eye } from 'lucide-react'
import { Link } from 'react-router'

interface SceneHeaderActionsProps {
	previewPath: string
}

/**
 * The one thing this header asks you to do.
 *
 * There were four controls stacked here. Publish & Embed became a door in the
 * facts column; Delete became a ghost at its foot; and Open in Publisher was
 * folded into `ScenePublishPanel` - which is where it belonged, because the
 * publish drawer's own action navigated to the very same route, so the page
 * offered two ways to one place and neither sat with the publication state.
 *
 * What is left is Preview: look at the scene as a visitor would. Everything to
 * do with shipping it now lives in one surface at the top of the column beside
 * this.
 */
export function SceneHeaderActions({ previewPath }: SceneHeaderActionsProps) {
	return (
		<div className="flex">
			<Button asChild className="max-sm:w-full max-sm:justify-start">
				<Link viewTransition to={previewPath}>
					<Eye className="mr-2 h-4 w-4 shrink-0" />
					Preview
				</Link>
			</Button>
		</div>
	)
}
