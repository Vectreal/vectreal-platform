import { describeAnimationClips } from '@vctrl/core'

import type { PlaybackClip } from './animation-playback'
import type { AnimationClipSource, AnimationSettings } from '@vctrl/core'

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
	if (!settings?.enabled || clips.length === 0) return []

	const descriptors = describeAnimationClips(clips)
	const byId = new Map(
		descriptors.map((descriptor) => [descriptor.clipId, descriptor])
	)

	return settings.clips
		.filter((config) => config.enabled)
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
}
