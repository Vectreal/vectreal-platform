import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtomValue } from 'jotai/react'
import { useEffect, useRef } from 'react'

import { usePublisherViewerCapture } from '../../components/publisher/publisher-viewer-capture-context'
import {
	planFirstOpenFill,
	waitForSettledBake
} from '../../lib/domain/scene/client/first-open-fill'
import {
	arePublisherActionsDisabledAtom,
	currentSceneIdAtom,
	lastSavedSceneMetaAtom,
	lastSavedSettingsAtom,
	openingFramedAtom
} from '../../lib/stores/publisher-config-store'
import { useLocationChangeState } from '../use-location-change-state'

import type { SaveAvailabilityState } from '../../lib/domain/scene/client/scene-save-state'
import type { SaveLocationTarget } from '../../types/publisher-scene'

interface UseFirstOpenFillArgs {
	saveSceneSettings: (target?: SaveLocationTarget) => Promise<unknown>
	saveAvailability: SaveAvailabilityState
	saveLocationTarget?: SaveLocationTarget
}

/**
 * Saves a scene once on open when it is missing what only a browser makes: a
 * thumbnail, or with shadows on, a baked shadow. Agents save scenes over v1
 * with neither, and until a save captures them the dashboard shows no image
 * and every embed visitor bakes the shadow live.
 *
 * It is the ordinary save, so the thumbnail is captured from the opening
 * camera and the bake persisted with its signature, as Save does. It waits for
 * the viewer's opening frame and for the bake to settle, and runs only on a
 * scene with no unsaved changes or picked location, outside preview, checked
 * again after the wait: an edit made meanwhile is the user's to save, and that
 * save captures both anyway. A bake that never settles saves only a missing
 * thumbnail, so an animated scene is not saved again on every open.
 */
export function useFirstOpenFill({
	saveSceneSettings,
	saveAvailability,
	saveLocationTarget
}: UseFirstOpenFillArgs) {
	const sceneId = useAtomValue(currentSceneIdAtom)
	const framed = useAtomValue(openingFramedAtom)
	const { file } = useModelContext()
	const savedMeta = useAtomValue(lastSavedSceneMetaAtom)
	const savedSettings = useAtomValue(lastSavedSettingsAtom)
	const actionsDisabled = useAtomValue(arePublisherActionsDisabledAtom)
	const { requestShadowBake } = usePublisherViewerCapture()
	// A picked location is an edit too: saving now would move the scene.
	const { hasUnsavedLocationChange } = useLocationChangeState()
	const isClean =
		saveAvailability.reason === 'no-unsaved-changes' &&
		!hasUnsavedLocationChange

	// Read after the wait, which can outlast several renders.
	const latest = useRef({
		sceneId,
		isClean,
		actionsDisabled,
		saveSceneSettings,
		saveLocationTarget
	})
	latest.current = {
		sceneId,
		isClean,
		actionsDisabled,
		saveSceneSettings,
		saveLocationTarget
	}
	const filledFor = useRef<string | null>(null)
	// Leaving the publisher mid-wait must not save after the viewer is gone.
	const mounted = useRef(true)
	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
		}
	}, [])

	const plan =
		savedMeta && savedSettings
			? planFirstOpenFill({
					thumbnailUrl: savedMeta.thumbnailUrl,
					settings: savedSettings
				})
			: null
	const needsBake = plan?.bake === true
	const needsThumbnail = plan?.thumbnail === true
	const ready =
		sceneId !== null &&
		file !== null &&
		framed?.sceneId === sceneId &&
		framed.file === file &&
		plan !== null &&
		isClean &&
		!actionsDisabled

	useEffect(() => {
		if (!ready || !sceneId || filledFor.current === sceneId) return
		filledFor.current = sceneId
		const stillOpen = () =>
			mounted.current && latest.current.sceneId === sceneId

		void (async () => {
			const settled = needsBake
				? await waitForSettledBake(requestShadowBake, {
						isCancelled: () => !stillOpen()
					})
				: false
			// A bake that never settles (an animating model bakes nothing) would
			// store nothing new, and the next open would ask again.
			if (!settled && !needsThumbnail) return
			const now = latest.current
			if (!stillOpen() || now.actionsDisabled || !now.isClean) {
				return
			}
			try {
				await now.saveSceneSettings(now.saveLocationTarget)
			} catch (error) {
				// Nothing is lost: the next open, or the user's own save, tries again.
				console.warn('[first-open-fill] save failed', error)
			}
		})()
	}, [ready, sceneId, needsBake, needsThumbnail, requestShadowBake])
}
