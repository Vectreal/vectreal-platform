import { describe, expect, it } from 'vitest'

import {
	initialPlaybackState,
	isProgramActive,
	reducePlayback
} from './animation-playback'

import type {
	PlaybackAction,
	PlaybackClip,
	PlaybackState
} from './animation-playback'

const clip = (
	clipId: string,
	overrides: Partial<PlaybackClip> = {}
): PlaybackClip => ({
	clipId,
	clipIndex: 0,
	duration: 2,
	loop: 'repeat',
	repetitions: 1,
	timeScale: 1,
	startOffset: 0,
	...overrides
})

/** Applies a list of actions, returning the final state and the last effects. */
const run = (
	actions: PlaybackAction[],
	from: PlaybackState = initialPlaybackState()
) =>
	actions.reduce<{ state: PlaybackState; effects: ReturnType<typeof reducePlayback>['effects'] }>(
		(acc, action) => reducePlayback(acc.state, action),
		{ state: from, effects: [] }
	)

const configure = (
	clips: PlaybackClip[],
	overrides: Partial<Extract<PlaybackAction, { type: 'configure' }>> = {}
): PlaybackAction => ({
	type: 'configure',
	clips,
	mode: 'simultaneous',
	loopSequence: false,
	autoplay: false,
	...overrides
})

describe('reducePlayback', () => {
	describe('configure', () => {
		it('tears down any previous program first', () => {
			const { effects } = run([configure([clip('a')], { autoplay: true })])
			expect(effects[0]).toEqual({ type: 'stop_all' })
		})

		it('starts every clip at once in simultaneous mode', () => {
			const { state, effects } = run([
				configure([clip('a'), clip('b')], { autoplay: true })
			])

			expect(effects.filter((effect) => effect.type === 'start')).toHaveLength(2)
			expect(state.isPlaying).toBe(true)
			expect(state.activeIndex).toBe(-1)
		})

		it('starts only the first clip in sequence mode', () => {
			const { state, effects } = run([
				configure([clip('a'), clip('b')], {
					mode: 'sequence',
					autoplay: true
				})
			])

			expect(effects).toEqual([
				{ type: 'stop_all' },
				{ type: 'start', clip: clip('a') }
			])
			expect(state.activeIndex).toBe(0)
		})

		it('stays idle without autoplay', () => {
			const { state, effects } = run([configure([clip('a')])])

			expect(state.isPlaying).toBe(false)
			expect(state.hasStarted).toBe(false)
			expect(effects).toEqual([{ type: 'stop_all' }])
		})

		it('resets completion carried over from a previous program', () => {
			const first = run([
				configure([clip('a', { loop: 'once' })], { autoplay: true }),
				{ type: 'clip_finished', clipId: 'a' }
			])
			expect(first.state.isComplete).toBe(true)

			const second = reducePlayback(first.state, configure([clip('b')]))
			expect(second.state.isComplete).toBe(false)
			expect(second.state.completed).toEqual([])
		})
	})

	describe('play and pause', () => {
		it('resumes rather than restarting after a pause', () => {
			const { effects, state } = run([
				configure([clip('a'), clip('b')], { autoplay: true }),
				{ type: 'pause' },
				{ type: 'play' }
			])

			expect(effects).toEqual([
				{ type: 'resume', clipId: 'a' },
				{ type: 'resume', clipId: 'b' }
			])
			expect(state.isPlaying).toBe(true)
		})

		it('starts from the beginning when it was never started', () => {
			const { effects } = run([configure([clip('a')]), { type: 'play' }])

			expect(effects).toEqual([
				{ type: 'stop_all' },
				{ type: 'start', clip: clip('a') }
			])
		})

		it('restarts a finished program', () => {
			const { effects, state } = run([
				configure([clip('a', { loop: 'once' })], { autoplay: true }),
				{ type: 'clip_finished', clipId: 'a' },
				{ type: 'play' }
			])

			expect(effects).toContainEqual({ type: 'stop_all' })
			expect(state.isComplete).toBe(false)
			expect(state.isPlaying).toBe(true)
		})

		it('resumes only the active clip in sequence mode', () => {
			const { effects } = run([
				configure([clip('a'), clip('b')], {
					mode: 'sequence',
					autoplay: true
				}),
				{ type: 'clip_finished', clipId: 'a' },
				{ type: 'pause' },
				{ type: 'play' }
			])

			expect(effects).toEqual([{ type: 'resume', clipId: 'b' }])
		})

		it('is inert when already playing or already paused', () => {
			const playing = run([configure([clip('a')], { autoplay: true })])
			expect(reducePlayback(playing.state, { type: 'play' }).effects).toEqual([])

			const paused = reducePlayback(playing.state, { type: 'pause' })
			expect(reducePlayback(paused.state, { type: 'pause' }).effects).toEqual([])
		})

		it('toggles between play and pause', () => {
			const playing = run([configure([clip('a')], { autoplay: true })])

			const paused = reducePlayback(playing.state, { type: 'toggle' })
			expect(paused.effects).toEqual([{ type: 'pause_all' }])

			const resumed = reducePlayback(paused.state, { type: 'toggle' })
			expect(resumed.state.isPlaying).toBe(true)
		})
	})

	describe('sequence advancement', () => {
		it('stops the finished clip and starts the next', () => {
			const { state, effects } = run([
				configure([clip('a'), clip('b')], {
					mode: 'sequence',
					autoplay: true
				}),
				{ type: 'clip_finished', clipId: 'a' }
			])

			expect(effects).toEqual([
				{ type: 'stop', clipId: 'a' },
				{ type: 'start', clip: clip('b') }
			])
			expect(state.activeIndex).toBe(1)
		})

		it('ignores a finish from a clip that is not holding the chain', () => {
			const { state, effects } = run([
				configure([clip('a'), clip('b')], {
					mode: 'sequence',
					autoplay: true
				}),
				// Stale event from a program that has since been reconfigured.
				{ type: 'clip_finished', clipId: 'b' }
			])

			expect(effects).toEqual([])
			expect(state.activeIndex).toBe(0)
		})

		it('wraps to the first clip when the chain loops', () => {
			const { state, effects } = run([
				configure([clip('a'), clip('b')], {
					mode: 'sequence',
					loopSequence: true,
					autoplay: true
				}),
				{ type: 'clip_finished', clipId: 'a' },
				{ type: 'clip_finished', clipId: 'b' }
			])

			expect(effects).toEqual([
				{ type: 'stop', clipId: 'b' },
				{ type: 'start', clip: clip('a') }
			])
			expect(state.activeIndex).toBe(0)
			expect(state.isPlaying).toBe(true)
		})

		it('completes without effects so the closing pose is held', () => {
			const { state, effects } = run([
				configure([clip('a'), clip('b')], {
					mode: 'sequence',
					autoplay: true
				}),
				{ type: 'clip_finished', clipId: 'a' },
				{ type: 'clip_finished', clipId: 'b' }
			])

			expect(effects).toEqual([])
			expect(state.isComplete).toBe(true)
			expect(state.isPlaying).toBe(false)
		})
	})

	describe('simultaneous completion', () => {
		it('completes only once every clip has reported', () => {
			const first = run([
				configure([clip('a'), clip('b')], { autoplay: true }),
				{ type: 'clip_finished', clipId: 'a' }
			])
			expect(first.state.isComplete).toBe(false)
			expect(first.state.isPlaying).toBe(true)

			const second = reducePlayback(first.state, {
				type: 'clip_finished',
				clipId: 'b'
			})
			expect(second.state.isComplete).toBe(true)
			expect(second.state.isPlaying).toBe(false)
		})

		it('never completes when a clip loops forever', () => {
			// An infinite clip never emits `finished`, so 'b' below simply never
			// reports and the program stays live indefinitely.
			const { state } = run([
				configure([clip('a'), clip('b', { repetitions: undefined })], {
					autoplay: true
				}),
				{ type: 'clip_finished', clipId: 'a' }
			])

			expect(state.isComplete).toBe(false)
			expect(state.isPlaying).toBe(true)
		})

		it('ignores a duplicate finish from the same clip', () => {
			const { state } = run([
				configure([clip('a'), clip('b')], { autoplay: true }),
				{ type: 'clip_finished', clipId: 'a' },
				{ type: 'clip_finished', clipId: 'a' }
			])

			expect(state.completed).toEqual(['a'])
			expect(state.isComplete).toBe(false)
		})

		it('ignores a finish from an unknown clip', () => {
			const { state } = run([
				configure([clip('a')], { autoplay: true }),
				{ type: 'clip_finished', clipId: 'ghost' }
			])

			expect(state.completed).toEqual([])
		})
	})

	describe('retune', () => {
		it('updates tuning without emitting any start', () => {
			const { state, effects } = run([
				configure([clip('a'), clip('b')], { autoplay: true }),
				{
					type: 'retune',
					clips: [clip('a', { timeScale: 3 }), clip('b', { timeScale: 3 })]
				}
			])

			expect(effects.every((effect) => effect.type === 'retune')).toBe(true)
			expect(state.clips[0]?.timeScale).toBe(3)
			expect(state.isPlaying).toBe(true)
		})
	})

	describe('edge cases', () => {
		it('is inert for every action when there are no clips', () => {
			const empty = run([configure([])]).state

			for (const action of [
				{ type: 'play' },
				{ type: 'pause' },
				{ type: 'toggle' },
				{ type: 'clip_finished', clipId: 'a' }
			] satisfies PlaybackAction[]) {
				expect(reducePlayback(empty, action).effects).toEqual([])
			}
		})

		it('emits a seek without changing state', () => {
			const playing = run([configure([clip('a')], { autoplay: true })])
			const seeked = reducePlayback(playing.state, {
				type: 'seek_clip',
				clipId: 'a',
				time: 1.5
			})

			expect(seeked.effects).toEqual([
				{ type: 'seek', clipId: 'a', time: 1.5 }
			])
			expect(seeked.state).toBe(playing.state)
		})
	})
})

describe('isProgramActive', () => {
	it('is true only while clips are actually playing', () => {
		const idle = initialPlaybackState()
		expect(isProgramActive(idle)).toBe(false)

		const playing = run([configure([clip('a')], { autoplay: true })]).state
		expect(isProgramActive(playing)).toBe(true)

		const paused = reducePlayback(playing, { type: 'pause' }).state
		expect(isProgramActive(paused)).toBe(false)
	})
})
