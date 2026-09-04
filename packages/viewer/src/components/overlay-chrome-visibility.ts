import type { LoadingState } from '../hooks/use-viewer-loading'

/**
 * Whether the viewer's DOM chrome - the info popover, the playback controls -
 * may be drawn yet.
 *
 * One rule for every piece of chrome, because they share a container and a
 * stacking order with the loader. Chrome is `z-[100]` and the loader layer is
 * `absolute inset-0` with no z-index of its own, so anything drawn early sits
 * on top of the spinner rather than beside it. The popover used to be rendered
 * outside this gate while the playback controls were inside it, which is
 * exactly the split this function exists to prevent: an info button offering to
 * describe a scene that has not arrived.
 *
 * `'loaded'` is not ready. It is the cross-fade window - the model is framed
 * but the loader is still fading out over it - so chrome appearing there would
 * still land on top of the spinner it is meant to follow.
 */
export function isViewerChromeVisible(loadingState: LoadingState): boolean {
	return loadingState === 'ready'
}
