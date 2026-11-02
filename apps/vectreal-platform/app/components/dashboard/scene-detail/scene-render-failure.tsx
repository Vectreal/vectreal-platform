import { Button } from '@shared/components/ui/button'

import { DetailPanelSection } from '../../layout-components'

/** Every word the card says, so a copy change is one edit here. */
export const SCENE_RENDER_FAILURE_COPY = {
	title: 'Unable to show scene',
	description:
		'This device stopped drawing the 3D scene, usually because it ran low on graphics memory.',
	retry: 'Try again',
	openPublisher: 'Open in Publisher'
} as const

interface SceneRenderFailureProps {
	onRetry: () => void
	onOpenPublisher: () => void
}

/**
 * The scene page's own answer to a viewer that gave up drawing, in place of
 * the viewer's one-line default: the author is here, so it can say why and
 * offer the Publisher, where a heavy scene can be made lighter.
 *
 * In the viewer's well, where the scene would be, rather than above it like
 * the load error card: the scene did load, it is the drawing that stopped.
 * `h2` for the same reason that card gives: this page renders no `h1`.
 */
export function SceneRenderFailure({
	onRetry,
	onOpenPublisher
}: SceneRenderFailureProps) {
	return (
		<div
			className="absolute inset-0 flex items-center justify-center p-4"
			role="alert"
		>
			<DetailPanelSection
				surface="raised"
				title={SCENE_RENDER_FAILURE_COPY.title}
				headingLevel="h2"
				description={SCENE_RENDER_FAILURE_COPY.description}
				className="max-w-sm"
			>
				<div className="flex flex-wrap gap-2">
					<Button type="button" onClick={onRetry}>
						{SCENE_RENDER_FAILURE_COPY.retry}
					</Button>
					<Button type="button" variant="outline" onClick={onOpenPublisher}>
						{SCENE_RENDER_FAILURE_COPY.openPublisher}
					</Button>
				</div>
			</DetailPanelSection>
		</div>
	)
}
