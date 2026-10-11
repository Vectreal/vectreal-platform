/**
 * The Publisher's view of a scene's animation settings against the clips the
 * loaded model actually carries.
 *
 * Core owns clip identity and reconciliation. What this module adds is the
 * authoring rule core deliberately leaves open: `reconcileSceneAnimation`
 * turns animation on for a model with clips and no saved config, and the
 * Publisher does not. A scene nobody animated stays still, and nothing is
 * written until the author touches the Animation tool, so opening such a scene
 * never reports it as edited.
 *
 * Pure, so the panel and its specs share every rule without a store.
 */

import { describeAnimationClips, reconcileSceneAnimation } from '@vctrl/core'

import type {
	AnimationClipConfig,
	AnimationClipSource,
	AnimationReconciliation,
	AnimationSettings
} from '@vctrl/core'

/**
 * Reconciles the saved config against the model's clips, with animation off
 * unless the author saved it on.
 *
 * Always lists every clip the model has, so the panel can show them before
 * anything has been saved; the first edit then writes this whole config.
 */
export function resolveAnimationDraft(
	saved: AnimationSettings | undefined,
	clips: readonly AnimationClipSource[]
): AnimationReconciliation {
	const reconciliation = reconcileSceneAnimation(
		saved,
		describeAnimationClips(clips)
	)

	return {
		...reconciliation,
		settings: {
			...reconciliation.settings,
			enabled: saved ? reconciliation.settings.enabled : false
		}
	}
}

/**
 * Whether a saved config no longer lines up with the model and has to be
 * rewritten. Never true without a saved config: there is nothing to drift.
 */
export function hasAnimationDrift(
	reconciliation: AnimationReconciliation,
	saved: AnimationSettings | undefined
): boolean {
	return (
		saved !== undefined &&
		(reconciliation.remapped.length > 0 ||
			reconciliation.dropped.length > 0 ||
			reconciliation.added.length > 0)
	)
}

/** The settings with one clip's config patched. */
export function updateAnimationClip(
	settings: AnimationSettings,
	clipId: string,
	patch: Partial<Omit<AnimationClipConfig, 'clipId'>>
): AnimationSettings {
	return {
		...settings,
		clips: settings.clips.map((clip) =>
			clip.clipId === clipId ? { ...clip, ...patch } : clip
		)
	}
}

/**
 * The settings with one clip swapped with its neighbor in the sequence. A
 * move past either end returns the settings unchanged.
 */
export function moveAnimationClip(
	settings: AnimationSettings,
	clipId: string,
	delta: -1 | 1
): AnimationSettings {
	const ordered = [...settings.clips].sort((a, b) => a.order - b.order)
	const from = ordered.findIndex((clip) => clip.clipId === clipId)
	const to = from + delta
	if (from < 0 || to < 0 || to >= ordered.length) return settings

	const swapped = [...ordered]
	;[swapped[from], swapped[to]] = [swapped[to], swapped[from]]

	return {
		...settings,
		clips: swapped.map((clip, order) => ({ ...clip, order }))
	}
}

/**
 * Whether the viewer will cut this clip's "forever" short to one pass.
 *
 * A clip that never finishes cannot hand off, so in a sequence the viewer
 * plays every clip that has to hand off at least once rather than stalling
 * (`clampHandoffRepetitions`): every clip that plays but the last, and the
 * last too when the sequence loops. Shown to the author instead of rewriting
 * the value they set.
 *
 * "Plays" is the viewer's rule (`resolvePlaybackClips`): enabled, present in
 * the model, and longer than zero seconds. Counting a clip the viewer drops
 * would name the wrong clip as last.
 */
export function isForeverCutShort(
	settings: AnimationSettings,
	clipId: string,
	clips: readonly AnimationClipSource[]
): boolean {
	if (settings.mode !== 'sequence') return false

	const playable = new Set(
		describeAnimationClips(clips)
			.filter((descriptor) => descriptor.duration > 0)
			.map((descriptor) => descriptor.clipId)
	)
	const playing = settings.clips
		.filter((clip) => clip.enabled && playable.has(clip.clipId))
		.sort((a, b) => a.order - b.order)
	const index = playing.findIndex((clip) => clip.clipId === clipId)
	if (index < 0) return false

	const clip = playing[index]
	const isForever = clip.loop !== 'once' && clip.repetitions === undefined
	const mustHandOff = settings.loopSequence || index < playing.length - 1

	return isForever && mustHandOff
}
