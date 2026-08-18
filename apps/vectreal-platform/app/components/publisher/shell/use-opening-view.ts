import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

import { resolveDefaultSceneCameraId } from '../../../lib/domain/scene/scene-camera'
import { sceneMetaAtom } from '../../../lib/stores/publisher-config-store'
import { cameraAtom } from '../../../lib/stores/scene-settings-store'
import { usePublisherViewerCapture } from '../publisher-viewer-capture-context'

import type { ModelFile } from '@vctrl/hooks/use-load-model'
import type { ViewerInteractionEvent } from '@vctrl/viewer'

/**
 * Capture settings for the opening view.
 *
 * `mode: 'viewport'` is required, for two reasons. It is what makes the
 * thumbnail the live frame rather than a reframed one, and it avoids the
 * default `auto-fit` path, which animates the camera with damping while the
 * capture waits only two frames — shooting mid-transition and returning the
 * environment with the model still out of frame.
 */
export const OPENING_VIEW_CAPTURE_OPTIONS = {
	width: 1280,
	height: 720,
	mimeType: 'image/webp' as const,
	quality: 0.86,
	mode: 'viewport' as const
}

/**
 * Sets the current viewport as the scene's opening view.
 *
 * Thumbnail and default camera are one concept, not two. The thumbnail is the
 * placeholder rendered while a scene loads, and the default camera is the frame
 * it resolves into, so capturing them independently guarantees a visible jump
 * at the end of every load. This writes both from the same live view, which
 * makes them consistent by construction rather than by convention.
 */
export function useOpeningViewCapture() {
	const { requestSceneScreenshot, requestSceneCameraSnapshot } =
		usePublisherViewerCapture()
	const setSceneMeta = useSetAtom(sceneMetaAtom)
	const setCamera = useSetAtom(cameraAtom)
	const [isCapturing, setIsCapturing] = useState(false)

	const setOpeningView = useCallback(
		async ({ announce = true }: { announce?: boolean } = {}) => {
		if (isCapturing) return
		setIsCapturing(true)

		try {
			// Both reads come from the same frame, before anything is written back,
			// so the pose and the image cannot describe different views.
			const [snapshot, dataUrl] = await Promise.all([
				requestSceneCameraSnapshot(),
				requestSceneScreenshot(OPENING_VIEW_CAPTURE_OPTIONS)
			])

			if (!dataUrl) {
				if (announce) {
					toast.error(
						'Could not capture the viewport. Try again once the scene has finished loading.'
					)
				}
				return
			}

			if (snapshot) {
				setCamera((previous) => {
					const defaultCameraId = resolveDefaultSceneCameraId(previous.cameras)
					if (!defaultCameraId) return previous

					return {
						...previous,
						cameras: previous.cameras?.map((entry) =>
							entry.cameraId === defaultCameraId
								? {
										...entry,
										position: snapshot.position,
										rotation: snapshot.rotation,
										target: snapshot.target,
										fov: snapshot.fov
									}
								: entry
						)
					}
				})
			}

			// Writing the meta is enough to mark the scene dirty: a `data:` URL only
			// ever comes from a capture in this session, which the change detection
			// treats as an unsaved edit.
			setSceneMeta((previous) => ({ ...previous, thumbnailUrl: dataUrl }))
			if (announce) {
				toast.success('Opening view updated. Save to keep it.')
			}
		} catch (error) {
			console.error('Opening view capture failed:', error)
			if (announce) {
				toast.error('Could not capture the viewport.')
			}
		} finally {
			setIsCapturing(false)
		}
	},
		[
			isCapturing,
			requestSceneCameraSnapshot,
			requestSceneScreenshot,
			setCamera,
			setSceneMeta
		]
	)

	return { setOpeningView, isCapturing }
}

/**
 * Gives a freshly uploaded model its opening view without being asked.
 *
 * An upload has no thumbnail and no saved camera, so the frame the viewer
 * settles on is the only opening view it has. Capturing it here means the same
 * code path produces it as when the user sets one deliberately, and it happens
 * at the one moment the frame is meaningful: the viewer reports that its
 * initial framing has stabilized.
 *
 * Returns the viewer's `onInteractionEvent` handler. Saved scenes keep the
 * opening view they were saved with.
 */
export function useAutomaticOpeningView() {
	const { file, source } = useModelContext()
	const { thumbnailUrl } = useAtomValue(sceneMetaAtom)
	const { setOpeningView } = useOpeningViewCapture()
	const capturedForRef = useRef<ModelFile | null>(null)

	return useCallback(
		(event: ViewerInteractionEvent) => {
			if (event.type !== 'initial_framing_completed') return
			if (!file || source !== 'files' || thumbnailUrl) return
			if (capturedForRef.current === file) return

			capturedForRef.current = file
			void setOpeningView({ announce: false })
		},
		[file, setOpeningView, source, thumbnailUrl]
	)
}
