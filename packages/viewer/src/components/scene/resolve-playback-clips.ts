import { describeAnimationClips } from '@vctrl/core'

import type { PlaybackClip } from './animation-playback'
import type { AnimationClipSource, AnimationSettings } from '@vctrl/core'

/**
 * Forces every clip that has to hand off to be finite.
 *
 * A clip with infinite repetitions never emits three's `finished` event, so a
 * sequence parked on one stalls with no way to advance and nothing to explain
 * it. Two clips have to end for a chain to keep moving:
 *
 * - every clip but the last, so the next one can start
 * - the last one too when `loopSequence` is set, so the chain can wrap
 *
 * Applied here rather than in the persisted config: this is a property of how
 * a program is played, not of what the author saved. Writing it back over their
 * settings meant a later switch to simultaneous mode inherited a clip that
 * quietly no longer looped.
 */
function clampHandoffRepetitions(
	clips: PlaybackClip[],
	loopSequence: boolean
): PlaybackClip[] {
	return clips.map((clip, index) => {
		const mustEnd = loopSequence || index < clips.length - 1
		if (!mustEnd) return clip
		if (clip.loop === 'once' || typeof clip.repetitions === 'number') return clip

		return { ...clip, repetitions: 1 }
	})
}

/**
 * Matches persisted clip configs against the clips a model actually carries.
 *
 * This is the viewer's half of clip identity, and it is deliberately lenient:
 * unlike the authoring surface it never reconciles, renames or reports. A
 * config with no matching clip is simply skipped, so a scene whose model has
 * drifted still renders and plays whatever does line up.
 *
 * Clips are also dropped when they cannot meaningfully play:
 * - disabled by the author
 * - zero length, which would either finish instantly or never fire at all,
 *   and in a sequence would stall or spin the chain
 */
export function resolvePlaybackClips(
	settings: AnimationSettings | undefined,
	clips: readonly AnimationClipSource[]
): PlaybackClip[] {
	// `settings` reaches the viewer straight from a consumer prop, which in
	// practice means persisted JSON. Nothing upstream guarantees `clips` is an
	// array, and indexing into a missing one would throw inside the R3F tree.
	if (!settings?.enabled || clips.length === 0) return []
	if (!Array.isArray(settings.clips)) return []

	const descriptors = describeAnimationClips(clips)
	const byId = new Map(
		descriptors.map((descriptor) => [descriptor.clipId, descriptor])
	)

	const resolved = settings.clips
		.filter((config) => config?.enabled)
		.slice()
		.sort((a, b) => a.order - b.order)
		.flatMap((config) => {
			const descriptor = byId.get(config.clipId)
			if (!descriptor || descriptor.duration <= 0) return []

			return [
				{
					clipId: descriptor.clipId,
					clipIndex: descriptor.index,
					duration: descriptor.duration,
					loop: config.loop,
					...(typeof config.repetitions === 'number'
						? { repetitions: config.repetitions }
						: {}),
					timeScale: config.timeScale,
					// A start offset past the end of the clip would never advance.
					startOffset: Math.min(
						Math.max(config.startOffset, 0),
						descriptor.duration
					)
				} satisfies PlaybackClip
			]
		})

	return settings.mode === 'sequence'
		? clampHandoffRepetitions(resolved, settings.loopSequence)
		: resolved
}
