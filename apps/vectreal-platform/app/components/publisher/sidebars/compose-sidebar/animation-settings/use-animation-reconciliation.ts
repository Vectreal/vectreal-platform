import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue } from 'jotai/react'
import { useEffect } from 'react'

import {
	hasAnimationDrift,
	resolveAnimationDraft
} from '../../../../../lib/domain/scene/scene-animation-draft'
import { lastSavedSettingsAtom } from '../../../../../lib/stores/publisher-config-store'
import {
	animationAtom,
	animationDriftAtom
} from '../../../../../lib/stores/scene-settings-store'

import type { AnimationClip } from 'three'

const NO_CLIPS: readonly AnimationClip[] = []

/**
 * The animation clips of the model on screen, or none while nothing is loaded.
 *
 * Stable across renders for one model, so effects keyed on it run once per
 * model rather than once per render.
 */
export function useModelClips(): readonly AnimationClip[] {
	const { file } = useModelContext()
	return file?.animations ?? NO_CLIPS
}

/**
 * Re-points a saved animation config at the clips the loaded model has, once
 * the two disagree: a clip renamed, removed or added since the scene was saved.
 *
 * Writing the reconciled config leaves the scene dirty, which is the point:
 * the author sees what changed (`animationDriftAtom`) and saves it, rather
 * than the published scene silently playing against a config that no longer
 * matches. It converges: a reconciled config reconciles to itself, so the
 * effect's own write finds no drift on its next run.
 *
 * Mounted once, beside the viewer, so it runs whether or not the Animation
 * tool is open. A scene with nothing saved is left alone, so it stays off.
 */
export function useAnimationReconciliation() {
	const { file } = useModelContext()
	const clips = file?.animations ?? NO_CLIPS
	const isModelLoaded = file !== null
	const [animation, setAnimation] = useAtom(animationAtom)
	const [animationDrift, setAnimationDrift] = useAtom(animationDriftAtom)
	const lastSavedSettings = useAtomValue(lastSavedSettingsAtom)

	// The report is news until the author saves what it describes. Cleared
	// here, not hidden in the panel, so a later edit cannot bring it back.
	// Declared before the reconcile effect, so in a flush that runs both, a
	// report written by that effect lands after this clear, not under it.
	useEffect(() => {
		if (!animationDrift) return
		const isSaved =
			JSON.stringify(animation ?? null) ===
			JSON.stringify(lastSavedSettings?.animation ?? null)
		if (isSaved) setAnimationDrift(null)
	}, [animation, animationDrift, lastSavedSettings, setAnimationDrift])

	useEffect(() => {
		if (!isModelLoaded || !animation) return

		const reconciliation = resolveAnimationDraft(animation, clips)
		if (!hasAnimationDrift(reconciliation, animation)) return

		setAnimation(reconciliation.settings)
		setAnimationDrift({
			added: reconciliation.added,
			dropped: reconciliation.dropped,
			remapped: reconciliation.remapped
		})
	}, [animation, clips, isModelLoaded, setAnimation, setAnimationDrift])
}
