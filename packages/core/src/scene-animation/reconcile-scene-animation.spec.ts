import { describe, expect, it } from 'vitest'

import { describeAnimationClips } from './describe-animation-clips'
import { reconcileSceneAnimation } from './reconcile-scene-animation'

import type { AnimationClipConfig, AnimationSettings } from '../types'

const model = (...names: string[]) =>
	describeAnimationClips(names.map((name) => ({ name, duration: 1 })))

/** Ids are opaque, so tests derive them the same way production does. */
const idOf = (name: string): string => model(name)[0]?.clipId as string

const clip = (
	name: string,
	overrides: Partial<AnimationClipConfig> = {}
): AnimationClipConfig => ({
	clipId: idOf(name),
	sourceName: name,
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

describe('reconcileSceneAnimation', () => {
	it('initializes from a model when nothing is saved', () => {
		const result = reconcileSceneAnimation(undefined, model('Spin', 'Idle'))

		expect(result.settings.clips.map((entry) => entry.clipId)).toEqual([
			idOf('Spin'),
			idOf('Idle')
		])
		expect(result.settings.clips.every((entry) => entry.enabled)).toBe(true)
		expect(result.added).toEqual([idOf('Spin'), idOf('Idle')])
		expect(result.dropped).toEqual([])
		expect(result.remapped).toEqual([])
	})

	it('treats null like nothing saved rather than failing', () => {
		expect(() => reconcileSceneAnimation(null, model('Spin'))).not.toThrow()
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
			clip('Spin', { sourceIndex: 0, order: 0, timeScale: 2 }),
			clip('Idle', { sourceIndex: 1, order: 1 })
		])

		const result = reconcileSceneAnimation(saved, model('Spin', 'Idle'))

		expect(result.matched).toEqual([idOf('Spin'), idOf('Idle')])
		expect(result.added).toEqual([])
		expect(result.dropped).toEqual([])
		expect(result.remapped).toEqual([])
		expect(result.settings.clips[0]?.timeScale).toBe(2)
	})

	it('drops a config whose clip is gone and renumbers order densely', () => {
		const saved = settings([
			clip('Spin', { sourceIndex: 0, order: 0 }),
			clip('Wave', { sourceIndex: 1, order: 1 }),
			clip('Idle', { sourceIndex: 2, order: 2 })
		])

		// 'Wave' removed. 'Idle' now sits at index 1, but its id is name-derived so
		// the exact pass still finds it and the positional fallback never runs.
		const result = reconcileSceneAnimation(saved, model('Spin', 'Idle'))

		expect(result.dropped.map((entry) => entry.clipId)).toEqual([idOf('Wave')])
		expect(result.remapped).toEqual([])
		expect(result.settings.clips.map((entry) => entry.clipId)).toEqual([
			idOf('Spin'),
			idOf('Idle')
		])
		expect(result.settings.clips.map((entry) => entry.order)).toEqual([0, 1])
	})

	it('appends a new clip with defaults after the survivors', () => {
		const saved = settings([clip('Spin', { sourceIndex: 0, order: 0 })])

		const result = reconcileSceneAnimation(saved, model('Spin', 'Jump'))

		expect(result.added).toEqual([idOf('Jump')])
		expect(result.settings.clips.map((entry) => entry.clipId)).toEqual([
			idOf('Spin'),
			idOf('Jump')
		])
		expect(result.settings.clips[1]).toMatchObject({
			enabled: true,
			loop: 'repeat',
			timeScale: 1,
			startOffset: 0,
			order: 1
		})
	})

	describe('the positional fallback', () => {
		it('re-attaches a renamed clip and keeps its tuning', () => {
			const saved = settings([
				clip('Spin', {
					sourceIndex: 0,
					order: 0,
					timeScale: 0.5,
					startOffset: 2
				})
			])

			const result = reconcileSceneAnimation(saved, model('Rotate'))

			expect(result.remapped).toEqual([
				{
					clipId: idOf('Rotate'),
					previousClipId: idOf('Spin'),
					sourceName: 'Rotate'
				}
			])
			expect(result.dropped).toEqual([])
			expect(result.settings.clips[0]).toMatchObject({
				clipId: idOf('Rotate'),
				sourceName: 'Rotate',
				timeScale: 0.5,
				startOffset: 2
			})
		})

		it('uses the config sourceIndex, not the first clip', () => {
			// Pins that the fallback reads `sourceIndex`. With a single-clip model
			// this is indistinguishable from `model[0]`, so the renamed clip has to
			// sit somewhere other than the front.
			const saved = settings([
				clip('Spin', { sourceIndex: 0, order: 0 }),
				clip('Wave', { sourceIndex: 2, order: 1, timeScale: 3 })
			])

			const result = reconcileSceneAnimation(
				saved,
				model('Spin', 'Idle', 'Renamed')
			)

			expect(result.remapped).toEqual([
				{
					clipId: idOf('Renamed'),
					previousClipId: idOf('Wave'),
					sourceName: 'Renamed'
				}
			])
			expect(
				result.settings.clips.find(
					(entry) => entry.clipId === idOf('Renamed')
				)?.timeScale
			).toBe(3)
		})

		it('keeps a remapped clip in its authored sequence position', () => {
			// The positional pass runs after the exact pass, so its matches are
			// appended. Without a re-sort a renamed first clip would be shoved to
			// the end of the chain the author built.
			const saved = settings([
				clip('Wave', { sourceIndex: 0, order: 0, timeScale: 4 }),
				clip('Spin', { sourceIndex: 1, order: 1 })
			])

			const result = reconcileSceneAnimation(saved, model('Renamed', 'Spin'))

			expect(result.settings.clips.map((entry) => entry.clipId)).toEqual([
				idOf('Renamed'),
				idOf('Spin')
			])
			expect(result.settings.clips[0]?.timeScale).toBe(4)
		})

		it('refreshes sourceIndex so the next reconciliation measures correctly', () => {
			const first = reconcileSceneAnimation(
				settings([clip('Spin', { sourceIndex: 0, order: 0, timeScale: 7 })]),
				model('Idle', 'Spin')
			)

			// Exact match moved it to index 1; that has to be written back.
			expect(first.settings.clips[0]?.sourceIndex).toBe(1)

			// A later rename at that index must now resolve through the fallback.
			const second = reconcileSceneAnimation(
				first.settings,
				model('Idle', 'Renamed')
			)

			expect(second.remapped.map((entry) => entry.sourceName)).toEqual([
				'Renamed'
			])
			expect(
				second.settings.clips.find(
					(entry) => entry.clipId === idOf('Renamed')
				)?.timeScale
			).toBe(7)
		})
	})

	it('matches by id when clips are reordered in the file', () => {
		const saved = settings([
			clip('Spin', { sourceIndex: 0, order: 0, timeScale: 3 }),
			clip('Idle', { sourceIndex: 1, order: 1 })
		])

		const result = reconcileSceneAnimation(saved, model('Idle', 'Spin'))

		expect(result.remapped).toEqual([])
		expect(result.dropped).toEqual([])
		// Saved authoring order wins over the file's new order.
		expect(result.settings.clips.map((entry) => entry.clipId)).toEqual([
			idOf('Spin'),
			idOf('Idle')
		])
		expect(result.settings.clips[0]).toMatchObject({
			clipId: idOf('Spin'),
			sourceIndex: 1,
			timeScale: 3
		})
	})

	it('keeps tuning with the name when two clips swap names', () => {
		// Two clips genuinely exchanging names is indistinguishable from a reorder
		// once ids are name-derived, which is the intended behavior: tuning follows
		// the name the author tuned, not the slot.
		const saved = settings([
			clip('Spin', { sourceIndex: 0, order: 0, timeScale: 2 }),
			clip('Idle', { sourceIndex: 1, order: 1, timeScale: 4 })
		])

		const result = reconcileSceneAnimation(saved, model('Idle', 'Spin'))

		expect(result.matched).toEqual([idOf('Spin'), idOf('Idle')])
		expect(result.settings.clips[0]).toMatchObject({
			clipId: idOf('Spin'),
			timeScale: 2
		})
	})

	it('reconciles unnamed clips positionally, which is all they have', () => {
		const [first, second] = model('', '')
		const saved = settings([
			{ ...clip(''), clipId: first?.clipId as string, sourceIndex: 0, order: 0, timeScale: 2 },
			{ ...clip(''), clipId: second?.clipId as string, sourceIndex: 1, order: 1 }
		])

		const result = reconcileSceneAnimation(saved, model('', ''))

		expect(result.matched).toEqual([first?.clipId, second?.clipId])
		expect(result.settings.clips[0]?.timeScale).toBe(2)
	})

	it('drops everything when the model has no clips at all', () => {
		const saved = settings([clip('Spin', { sourceIndex: 0, order: 0 })])

		const result = reconcileSceneAnimation(saved, model())

		expect(result.settings.clips).toEqual([])
		expect(result.dropped.map((entry) => entry.clipId)).toEqual([idOf('Spin')])
	})

	it('never re-attaches two configs to the same clip', () => {
		const saved = settings([
			clip('GoneA', { sourceIndex: 0, order: 0 }),
			clip('GoneB', { sourceIndex: 0, order: 1 })
		])

		const result = reconcileSceneAnimation(saved, model('Renamed'))

		expect(result.remapped).toHaveLength(1)
		expect(result.dropped.map((entry) => entry.clipId)).toEqual([idOf('GoneB')])
		expect(result.settings.clips).toHaveLength(1)
	})

	it('normalizes a partially-written saved config instead of passing it through', () => {
		// The realistic producer is persisted JSON. A config missing `enabled`,
		// `loop` or `timeScale` used to be spread straight into the result and
		// reached the mixer as undefined.
		const result = reconcileSceneAnimation(
			{ clips: [{ clipId: idOf('Spin') }] } as unknown as AnimationSettings,
			model('Spin')
		)

		expect(result.settings.clips[0]).toMatchObject({
			enabled: true,
			loop: 'repeat',
			timeScale: 1,
			startOffset: 0
		})
	})

	it('preserves scene-level settings across reconciliation', () => {
		const saved: AnimationSettings = {
			...settings([clip('Spin', { sourceIndex: 0, order: 0 })]),
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
