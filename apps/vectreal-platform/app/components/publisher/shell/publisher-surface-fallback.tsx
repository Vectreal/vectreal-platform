import { Button } from '@shared/components/ui/button'
import { LoadProgressIndicator } from '@shared/components/ui/load-progress-indicator'
import { useLoadProgress, useModelContext } from '@vctrl/hooks/use-load-model'

import { getUploadLoadErrorMessage } from '../../../lib/domain/scene/scene-load-error-messages'

import type { PublisherSurface } from '../../../lib/publisher/publisher-surface'

interface Props {
	surface: Exclude<PublisherSurface, 'empty' | 'viewer'>
	/** What is being opened, when it has a name: "Downloading Rocket". */
	subject?: null | string
	/** Reloads the scene the route points at. */
	onRetry: () => void
}

/**
 * What the canvas stage shows on a scene route with no model in it.
 *
 * Both cases used to fall through to the drop zone, which is how a scene route
 * ended up asking the user to upload a file into a scene that already exists.
 */
export function PublisherSurfaceFallback({ surface, subject, onRetry }: Props) {
	const model = useModelContext()
	const progress = useLoadProgress(model)

	if (surface === 'loading') {
		// The viewer's own ground, so handing over to it changes nothing on screen.
		return (
			<div className="bg-muted/50 flex grow">
				<LoadProgressIndicator
					progress={progress}
					subject={subject ?? undefined}
					className="grow"
				/>
			</div>
		)
	}

	const { error } = model

	return (
		<div className="flex h-full w-full items-center justify-center p-6">
			<section className="ds-raised max-w-md space-y-3 rounded-2xl p-5 text-center">
				{/*
				  `h1`: this stands in for the stage, the page's main content, and is
				  the publisher's only other `h1` beside the empty stage it alternates
				  with. Sidebar panels open around it head their own sections.
				*/}
				<h1 className="text-h4">Unable to load this scene</h1>
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
