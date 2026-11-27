import { useSetAtom } from 'jotai/react'
import { useCallback } from 'react'

import {
	enterPreviewModeAtom,
	exitPreviewModeAtom
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
	const { requestSceneCameraSnapshot, restoreSceneCameraSnapshot } =
		usePublisherViewerCapture()

	const enterPreview = useCallback(async () => {
		enter(await requestSceneCameraSnapshot())
	}, [enter, requestSceneCameraSnapshot])

	const exitPreview = useCallback(() => {
		const view = exit()
		// The viewer puts it back on its next frame, after the selection moving
		// back and the editor's controls have landed.
		if (view) restoreSceneCameraSnapshot(view)
	}, [exit, restoreSceneCameraSnapshot])

	return { enterPreview, exitPreview }
}
