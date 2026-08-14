import { describe, expect, it } from 'vitest'

import { describeAnimationClips } from './describe-animation-clips'
import { reconcileSceneAnimation } from './reconcile-scene-animation'

import type { AnimationClipConfig, AnimationSettings } from '../types'

const clip = (
	clipId: string,
	overrides: Partial<AnimationClipConfig> = {}
): AnimationClipConfig => ({
	clipId,
	sourceName: clipId,
	sourceIndex: 0,
	enabled: true,
	order: 0,
	loop: 'repeat',
	timeScale: 1,
	startOffset: 0,
	...overrides
})

const settings = (clips: AnimationClipConfig[]): AnimationSettings => ({
	enabled: true,
	mode: 'sequence',
	autoplay: true,
	loopSequence: false,
	showControls: false,
	clips
})

const model = (...names: string[]) =>
	describeAnimationClips(names.map((name) => ({ name, duration: 1 })))

describe('reconcileSceneAnimation', () => {
	it('initializes from a model when nothing is saved', () => {
		const result = reconcileSceneAnimation(undefined, model('Spin', 'Idle'))

		expect(result.settings.clips.map((entry) => entry.clipId)).toEqual([
			'spin',
			'idle'
		])
		expect(result.settings.clips.every((entry) => entry.enabled)).toBe(true)
		expect(result.added).toEqual(['spin', 'idle'])
		expect(result.dropped).toEqual([])
		expect(result.remapped).toEqual([])
	})

	it('enables animation only when the model actually has clips', () => {
		expect(reconcileSceneAnimation(undefined, model()).settings.enabled).toBe(
			false
		)
		expect(
			reconcileSceneAnimation(undefined, model('Spin')).settings.enabled
		).toBe(true)
	})

	it('is a no-op for an unchanged model', () => {
		const saved = settings([
			clip('spin', { sourceIndex: 0, order: 0, timeScale: 2 }),
			clip('idle', { sourceIndex: 1, order: 1 })
		])

		const result = reconcileSceneAnimation(saved, model('Spin', 'Idle'))

		expect(result.matched).toEqual(['spin', 'idle'])
		expect(result.added).toEqual([])
		expect(result.dropped).toEqual([])
		expect(result.remapped).toEqual([])
		expect(result.settings.clips[0]?.timeScale).toBe(2)
	})

	it('drops a config whose clip is gone and renumbers order densely', () => {
		const saved = settings([
			clip('spin', { sourceIndex: 0, order: 0 }),
			clip('wave', { sourceIndex: 1, order: 1 }),
			clip('idle', { sourceIndex: 2, order: 2 })
		])

		// 'Wave' removed, and 'Idle' has moved up a slot as a result.
		const result = reconcileSceneAnimation(saved, model('Spin', 'Idle'))

		expect(result.dropped.map((entry) => entry.clipId)).toEqual(['wave'])
		expect(result.settings.clips.map((entry) => entry.clipId)).toEqual([
			'spin',
			'idle'
		])
		expect(result.settings.clips.map((entry) => entry.order)).toEqual([0, 1])
	})

	it('appends a new clip with defaults after the survivors', () => {
		const saved = settings([clip('spin', { sourceIndex: 0, order: 0 })])

		const result = reconcileSceneAnimation(saved, model('Spin', 'Jump'))

		expect(result.added).toEqual(['jump'])
		expect(result.settings.clips.map((entry) => entry.clipId)).toEqual([
			'spin',
			'jump'
		])
		expect(result.settings.clips[1]).toMatchObject({
			enabled: true,
			loop: 'repeat',
			timeScale: 1,
			startOffset: 0,
			order: 1
		})
	})

	it('re-attaches a renamed clip by position and keeps its tuning', () => {
		const saved = settings([
			clip('spin', { sourceIndex: 0, order: 0, timeScale: 0.5, startOffset: 2 })
		])

		const result = reconcileSceneAnimation(saved, model('Rotate'))

		expect(result.remapped).toEqual([
			{ clipId: 'rotate', previousClipId: 'spin', sourceName: 'Rotate' }
		])
		expect(result.dropped).toEqual([])
		expect(result.settings.clips[0]).toMatchObject({
			clipId: 'rotate',
			sourceName: 'Rotate',
			timeScale: 0.5,
			startOffset: 2
		})
	})

	it('matches by id when clips are reordered in the file', () => {
		const saved = settings([
			clip('spin', { sourceIndex: 0, order: 0, timeScale: 3 }),
			clip('idle', { sourceIndex: 1, order: 1 })
		])

		// Same two clips, swapped positions in the source file.
		const result = reconcileSceneAnimation(saved, model('Idle', 'Spin'))

		expect(result.remapped).toEqual([])
		expect(result.dropped).toEqual([])
		// Saved authoring order wins over the file's new order.
		expect(result.settings.clips.map((entry) => entry.clipId)).toEqual([
			'spin',
			'idle'
		])
		// sourceIndex is refreshed to where the clip now actually lives.
		expect(result.settings.clips[0]).toMatchObject({
			clipId: 'spin',
			sourceIndex: 1,
			timeScale: 3
		})
	})

	it('matches by id first when two clips swap names', () => {
		const saved = settings([
			clip('spin', { sourceIndex: 0, order: 0, timeScale: 2 }),
			clip('idle', { sourceIndex: 1, order: 1, timeScale: 4 })
		])

		const result = reconcileSceneAnimation(saved, model('Idle', 'Spin'))

		// Both ids still exist, so the exact pass consumes them and the positional
		// fallback never runs. Tuning follows the name, not the slot.
		expect(result.matched).toEqual(['spin', 'idle'])
		expect(result.settings.clips[0]).toMatchObject({
			clipId: 'spin',
			timeScale: 2
		})
	})

	it('reconciles positionally when every clip is unnamed', () => {
		const saved = settings([
			clip('clip-0', { sourceIndex: 0, order: 0, timeScale: 2 }),
			clip('clip-1', { sourceIndex: 1, order: 1 })
		])

		const result = reconcileSceneAnimation(saved, model('', ''))

		expect(result.matched).toEqual(['clip-0', 'clip-1'])
		expect(result.settings.clips[0]?.timeScale).toBe(2)
	})

	it('drops everything when the model has no clips at all', () => {
		const saved = settings([clip('spin', { sourceIndex: 0, order: 0 })])

		const result = reconcileSceneAnimation(saved, model())

		expect(result.settings.clips).toEqual([])
		expect(result.dropped.map((entry) => entry.clipId)).toEqual(['spin'])
	})

	it('never re-attaches two configs to the same clip', () => {
		// Both configs point at index 0 after their names stopped matching.
		const saved = settings([
			clip('gone-a', { sourceIndex: 0, order: 0 }),
			clip('gone-b', { sourceIndex: 0, order: 1 })
		])

		const result = reconcileSceneAnimation(saved, model('Renamed'))

		expect(result.remapped).toHaveLength(1)
		expect(result.dropped.map((entry) => entry.clipId)).toEqual(['gone-b'])
		expect(result.settings.clips).toHaveLength(1)
	})

	it('preserves scene-level settings across reconciliation', () => {
		const saved: AnimationSettings = {
			...settings([clip('spin', { sourceIndex: 0, order: 0 })]),
			mode: 'sequence',
			loopSequence: true,
			showControls: true,
			autoplay: false
		}

		const result = reconcileSceneAnimation(saved, model('Spin'))

		expect(result.settings).toMatchObject({
			mode: 'sequence',
			loopSequence: true,
			showControls: true,
			autoplay: false
		})
	})
})
