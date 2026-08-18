import { Button } from '@shared/components/ui/button'
import { useModelContext } from '@vctrl/hooks/use-load-model'

import { getUploadLoadErrorMessage } from '../../../lib/domain/scene/scene-load-error-messages'
import CenteredSpinner from '../../centered-spinner'

import type { PublisherSurface } from '../../../lib/publisher/publisher-surface'

interface Props {
	surface: Exclude<PublisherSurface, 'drop-zone' | 'viewer'>
	/** Reloads the scene the route points at. */
	onRetry: () => void
}

/**
 * What the canvas stage shows on a scene route with no model in it.
 *
 * Both cases used to fall through to the drop zone, which is how a scene route
 * ended up asking the user to upload a file into a scene that already exists.
 */
export function PublisherSurfaceFallback({ surface, onRetry }: Props) {
	const { error } = useModelContext()

	if (surface === 'loading') {
		return <CenteredSpinner text="Loading Scene..." />
	}

	return (
		<div className="flex h-full w-full items-center justify-center p-6">
			<section className="ds-raised max-w-md space-y-3 rounded-2xl p-5 text-center">
				<h2 className="text-h4">Unable to load this scene</h2>
				<p className="text-muted-foreground text-sm">
					{getUploadLoadErrorMessage(error)}
				</p>
				<Button type="button" onClick={onRetry}>
					Retry
				</Button>
			</section>
		</div>
	)
}
