import { describeAnimationClips } from '@vctrl/core'
import { describe, expect, it } from 'vitest'

import {
	hasAnimationDrift,
	isForeverCutShort,
	moveAnimationClip,
	resolveAnimationDraft,
	updateAnimationClip
} from './scene-animation-draft'

import type { AnimationSettings } from '@vctrl/core'

const clips = [
	{ name: 'Walk', duration: 1.2 },
	{ name: 'Run', duration: 0.8 },
	{ name: 'Survey', duration: 3 }
]

/** The stable id core derives for a clip of `clips`, by name. */
const idOf = (name: string) => {
	const descriptor = describeAnimationClips(clips).find(
		(entry) => entry.name === name
	)
	if (!descriptor) throw new Error(`no clip named ${name}`)
	return descriptor.clipId
}

/** What the Publisher writes on the author's first edit. */
const savedOn = (): AnimationSettings => ({
	...resolveAnimationDraft(undefined, clips).settings,
	enabled: true
})

describe('resolveAnimationDraft', () => {
	it('keeps a model with clips still until the author turns animation on', () => {
		const { settings } = resolveAnimationDraft(undefined, clips)

		expect(settings.enabled).toBe(false)
		expect(settings.clips.map((clip) => clip.sourceName)).toEqual([
			'Walk',
			'Run',
			'Survey'
		])
	})

	it('keeps what the author saved', () => {
		const saved = { ...savedOn(), mode: 'sequence' as const, autoplay: false }

		expect(resolveAnimationDraft(saved, clips).settings).toMatchObject({
			enabled: true,
			mode: 'sequence',
			autoplay: false
		})
	})

	it('keeps a saved "off" off', () => {
		const saved = { ...savedOn(), enabled: false }

		expect(resolveAnimationDraft(saved, clips).settings.enabled).toBe(false)
	})
})

describe('hasAnimationDrift', () => {
	it('is false for a scene with nothing saved, however many clips it has', () => {
		const reconciliation = resolveAnimationDraft(undefined, clips)

		expect(reconciliation.added).toHaveLength(3)
		expect(hasAnimationDrift(reconciliation, undefined)).toBe(false)
	})

	it('is false when the saved config matches the model', () => {
		const saved = savedOn()

		expect(hasAnimationDrift(resolveAnimationDraft(saved, clips), saved)).toBe(
			false
		)
	})

	it('reports a renamed clip and keeps its tuning', () => {
		const saved = updateAnimationClip(savedOn(), idOf('Run'), { timeScale: 2 })
		const renamed = [clips[0], { name: 'Sprint', duration: 0.8 }, clips[2]]
		const reconciliation = resolveAnimationDraft(saved, renamed)

		expect(hasAnimationDrift(reconciliation, saved)).toBe(true)
		expect(reconciliation.remapped).toMatchObject([
			{ previousClipId: idOf('Run'), sourceName: 'Sprint' }
		])
		expect(
			reconciliation.settings.clips.find((clip) => clip.sourceName === 'Sprint')
				?.timeScale
		).toBe(2)
	})

	it('reports a clip the model no longer has', () => {
		const saved = savedOn()
		const reconciliation = resolveAnimationDraft(saved, clips.slice(0, 2))

		expect(hasAnimationDrift(reconciliation, saved)).toBe(true)
		expect(reconciliation.dropped.map((clip) => clip.sourceName)).toEqual([
			'Survey'
		])
	})

	it('converges: a reconciled config reconciles to itself', () => {
		const saved = savedOn()
		const first = resolveAnimationDraft(saved, clips.slice(0, 2))
		const second = resolveAnimationDraft(first.settings, clips.slice(0, 2))

		expect(hasAnimationDrift(second, first.settings)).toBe(false)
	})
})

describe('moveAnimationClip', () => {
	const orderOf = (settings: AnimationSettings) =>
		[...settings.clips]
			.sort((a, b) => a.order - b.order)
			.map((clip) => clip.sourceName)

	it('swaps a clip with its neighbor and keeps the order dense', () => {
		const moved = moveAnimationClip(savedOn(), idOf('Survey'), -1)

		expect(orderOf(moved)).toEqual(['Walk', 'Survey', 'Run'])
		expect(moved.clips.map((clip) => clip.order).sort()).toEqual([0, 1, 2])
	})

	it('leaves the order alone past either end', () => {
		const settings = savedOn()

		expect(moveAnimationClip(settings, idOf('Walk'), -1)).toBe(settings)
		expect(moveAnimationClip(settings, idOf('Survey'), 1)).toBe(settings)
	})
})

describe('isForeverCutShort', () => {
	const sequence = (loopSequence = false): AnimationSettings => ({
		...savedOn(),
		mode: 'sequence',
		loopSequence
	})

	it('flags a forever clip that has to hand off to the next', () => {
		expect(isForeverCutShort(sequence(), idOf('Walk'), clips)).toBe(true)
	})

	it('lets the last clip loop forever unless the sequence loops', () => {
		expect(isForeverCutShort(sequence(), idOf('Survey'), clips)).toBe(false)
		expect(isForeverCutShort(sequence(true), idOf('Survey'), clips)).toBe(true)
	})

	it('ignores a clip with a finite count, and every clip played together', () => {
		expect(
			isForeverCutShort(
				updateAnimationClip(sequence(), idOf('Walk'), { repetitions: 3 }),
				idOf('Walk'),
				clips
			)
		).toBe(false)
		expect(isForeverCutShort(savedOn(), idOf('Walk'), clips)).toBe(false)
	})

	it('does not count a zero-length clip the viewer will drop as last', () => {
		const withPose = [...clips, { name: 'Pose', duration: 0 }]
		const settings: AnimationSettings = {
			...resolveAnimationDraft(undefined, withPose).settings,
			enabled: true,
			mode: 'sequence'
		}

		expect(isForeverCutShort(settings, idOf('Survey'), withPose)).toBe(false)
	})

	it('counts only included clips when finding the last one', () => {
		const lastExcluded = updateAnimationClip(sequence(), idOf('Survey'), {
			enabled: false
		})

		expect(isForeverCutShort(lastExcluded, idOf('Run'), clips)).toBe(false)
	})
})
