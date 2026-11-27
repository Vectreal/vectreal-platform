import { useSetAtom } from 'jotai/react'
import { useCallback } from 'react'

import {
	enterPreviewModeAtom,
	exitPreviewModeAtom,
	viewLensAtom,
	viewMovedAtom
} from '../../../lib/stores/publisher-config-store'
import { usePublisherViewerCapture } from '../publisher-viewer-capture-context'

/**
 * Entering and leaving preview, with the editor's view kept across it: the
 * view is read before preview flies to the opening camera, and put back
 * exactly on exit rather than on the selected camera's saved pose.
 */
export function usePreviewToggle() {
	const enter = useSetAtom(enterPreviewModeAtom)
	const exit = useSetAtom(exitPreviewModeAtom)
	const setViewMoved = useSetAtom(viewMovedAtom)
	const setViewLens = useSetAtom(viewLensAtom)
	const { requestSceneCameraSnapshot, restoreSceneCameraSnapshot } =
		usePublisherViewerCapture()

	const enterPreview = useCallback(async () => {
		enter(await requestSceneCameraSnapshot())
	}, [enter, requestSceneCameraSnapshot])

	const exitPreview = useCallback(() => {
		const returned = exit()
		if (!returned) return
		const { view, viewMoved } = returned
		// The viewer puts it back on its next frame, after the selection moving
		// back and the editor's controls have landed. That arrival ends a moved
		// view, so whether this one had moved is set again once it is back.
		restoreSceneCameraSnapshot(view, () => {
			setViewMoved(viewMoved)
			setViewLens(viewMoved ? view.fov : null)
		})
	}, [exit, restoreSceneCameraSnapshot, setViewLens, setViewMoved])

	return { enterPreview, exitPreview }
}
