import { deriveAnimationClipId } from './derive-clip-id'

/**
 * The part of an animation clip this module needs.
 *
 * Declared structurally rather than importing `AnimationClip`, so clip identity
 * stays testable with plain objects and core keeps this path free of three.
 */
export interface AnimationClipSource {
	name: string
	duration: number
}

/** One clip resolved to its stable id and its position in the source list. */
export interface AnimationClipDescriptor {
	clipId: string
	/** Raw glTF name, empty when the clip is unnamed. */
	name: string
	/** Zero-based position in the source clip list. */
	index: number
	/** Clip length in seconds. */
	duration: number
}

/**
 * Resolves a model's clips to stable descriptors.
 *
 * This is the single entry point for clip identity. Everything that needs to
 * match a persisted config against a loaded model goes through it, so both
 * sides derive ids by exactly the same rules.
 */
export function describeAnimationClips(
	clips: readonly AnimationClipSource[]
): AnimationClipDescriptor[] {
	const seen = new Map<string, number>()

	return clips.map((clip, index) => ({
		clipId: deriveAnimationClipId(clip.name, seen),
		name: clip.name ?? '',
		index,
		duration: clip.duration
	}))
}
