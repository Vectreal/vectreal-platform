import { normalizeSceneAnimation } from './normalize-scene-animation'

import type { AnimationClipDescriptor } from './describe-animation-clips'
import type {
	AnimationClipConfig,
	AnimationSettings
} from '../types/animation-types'

/** A saved config re-attached to a clip by position after its name changed. */
export interface AnimationClipRemap {
	/** The id the config now points at. */
	clipId: string
	/** The id it was saved under. */
	previousClipId: string
	/** The clip's current name, for explaining the remap to the author. */
	sourceName: string
}

/** Outcome of matching a saved config against the clips a model actually has. */
export interface AnimationReconciliation {
	settings: AnimationSettings
	/** Clip ids that matched exactly. */
	matched: string[]
	/** Configs re-attached by position after a rename. */
	remapped: AnimationClipRemap[]
	/** Clip ids present on the model that had no saved config. */
	added: string[]
	/** Saved configs with no clip left to attach to. */
	dropped: AnimationClipConfig[]
}

function createDefaultClipConfig(
	descriptor: AnimationClipDescriptor,
	order: number
): AnimationClipConfig {
	return {
		clipId: descriptor.clipId,
		sourceName: descriptor.name,
		sourceIndex: descriptor.index,
		enabled: true,
		order,
		loop: 'repeat',
		timeScale: 1,
		startOffset: 0
	}
}

/**
 * Matches a persisted animation config against the clips a model actually has.
 *
 * Re-uploading a revised model is routine, and clips get renamed, reordered and
 * removed between exports. Two passes handle that:
 *
 * 1. Exact id. Because ids are name-derived rather than positional, this alone
 *    survives clips being reordered inside the source file.
 * 2. Position, via the config's `sourceIndex`. This catches the common case of
 *    an author renaming a clip in their 3D tool and re-exporting.
 *
 * The second pass deliberately re-attaches rather than discarding: losing the
 * author's per-clip tuning on a rename is worse than re-applying it against a
 * clip that may not be the same one. What makes that trade safe is that every
 * remap is reported, so the UI can say so instead of quietly guessing.
 *
 * Runs in the authoring surface only. The viewer never reconciles; it resolves
 * what it can and ignores the rest, so it can never fail on drift.
 */
export function reconcileSceneAnimation(
	saved: AnimationSettings | null | undefined,
	model: readonly AnimationClipDescriptor[]
): AnimationReconciliation {
	// The realistic producer of `saved` is persisted JSON, whatever the static
	// type claims. Without this, a half-written config was spread straight into
	// the result and could emit clips with no `enabled`, `loop` or `timeScale` —
	// which then reached three as `undefined` and became NaN in the mixer.
	const settings = normalizeSceneAnimation(saved)
	const savedClips = settings?.clips ?? []
	const byId = new Map(model.map((descriptor) => [descriptor.clipId, descriptor]))
	const consumed = new Set<number>()

	const matched: string[] = []
	const remapped: AnimationClipRemap[] = []
	const dropped: AnimationClipConfig[] = []
	const survivors: AnimationClipConfig[] = []

	// Saved order is preserved for survivors, so a chain the author arranged
	// keeps its shape even when clips around it change.
	const ordered = [...savedClips].sort((a, b) => a.order - b.order)
	const pending: AnimationClipConfig[] = []

	for (const config of ordered) {
		const exact = byId.get(config.clipId)

		if (exact && !consumed.has(exact.index)) {
			consumed.add(exact.index)
			matched.push(exact.clipId)
			survivors.push({
				...config,
				sourceName: exact.name,
				sourceIndex: exact.index
			})
			continue
		}

		pending.push(config)
	}

	for (const config of pending) {
		const positional = model[config.sourceIndex]

		if (positional && !consumed.has(positional.index)) {
			consumed.add(positional.index)
			remapped.push({
				clipId: positional.clipId,
				previousClipId: config.clipId,
				sourceName: positional.name
			})
			survivors.push({
				...config,
				clipId: positional.clipId,
				sourceName: positional.name,
				sourceIndex: positional.index
			})
			continue
		}

		dropped.push(config)
	}

	// Re-sort survivors: the positional pass appends its matches, which would
	// otherwise push a remapped clip to the end of a sequence the author built.
	survivors.sort((a, b) => a.order - b.order)

	const additions = model
		.filter((descriptor) => !consumed.has(descriptor.index))
		.map((descriptor, offset) =>
			createDefaultClipConfig(descriptor, survivors.length + offset)
		)

	const clips = [...survivors, ...additions].map((clip, order) => ({
		...clip,
		order
	}))

	return {
		settings: {
			// With no saved config, a model that has clips should animate rather
			// than sit still with nothing explaining why. A model with no clips
			// leaves the feature off.
			enabled: settings?.enabled ?? model.length > 0,
			mode: settings?.mode ?? 'simultaneous',
			autoplay: settings?.autoplay ?? true,
			loopSequence: settings?.loopSequence ?? false,
			showControls: settings?.showControls ?? false,
			clips
		},
		matched,
		remapped,
		added: additions.map((clip) => clip.clipId),
		dropped
	}
}
