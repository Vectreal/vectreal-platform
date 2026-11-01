import { describe, expect, it } from 'vitest'

import {
	isSaveInFlight,
	reduceSaveProgress,
	saveStepStatus,
	summarizeSaveProgress
} from './scene-save-progress'

import type { SavePanelEvent, SavePanelState } from './scene-save-progress'

const fold = (events: SavePanelEvent[], start: SavePanelState | null = null) =>
	events.reduce(reduceSaveProgress, start)

const file = (
	key: string,
	bytes: number,
	group: 'model' | 'preview' = 'model'
): SavePanelEvent => ({
	type: 'file-added',
	file: { key, group, name: key, bytes },
	previewUrl: null
})

describe('reduceSaveProgress', () => {
	it('shows a save that failed before reporting anything', () => {
		expect(fold([{ type: 'failed', message: 'No user' }])).toEqual({
			status: 'failed',
			files: [],
			message: 'No user'
		})
	})

	it('starts every save clean, whatever the last one left', () => {
		const failed = fold([
			{ type: 'preparing' },
			file('a', 10),
			{ type: 'failed', message: 'x' }
		])

		expect(fold([{ type: 'preparing' }], failed)).toEqual({
			status: 'preparing',
			files: [],
			message: null
		})
	})

	it('ignores progress that arrives with no save to belong to', () => {
		expect(fold([file('a', 10)])).toBeNull()
	})
})

describe('summarizeSaveProgress', () => {
	it('measures progress by bytes, not by files', () => {
		const state = fold([
			{ type: 'preparing' },
			file('small', 10),
			file('large', 90),
			{ type: 'file-done', key: 'small', reused: false }
		]) as SavePanelState

		expect(summarizeSaveProgress(state).percent).toBe(10)
	})

	it('groups files in a fixed order and says how each group stands', () => {
		const state = fold([
			{ type: 'preparing' },
			file('thumb', 5, 'preview'),
			file('a', 10),
			file('b', 10),
			{ type: 'file-done', key: 'a', reused: true },
			{ type: 'file-progress', key: 'b', fraction: 0.5 },
			{ type: 'file-done', key: 'thumb', reused: false }
		]) as SavePanelState

		const { groups } = summarizeSaveProgress(state)
		expect(
			groups.map((group) => [group.group, group.state, group.reused])
		).toEqual([
			['model', 'active', 1],
			['preview', 'done', 0]
		])
		expect(groups[0].sent).toBe(15)
	})

	it('reads a group with a failed file as failed', () => {
		const state = fold([
			{ type: 'preparing' },
			file('a', 10),
			{ type: 'file-failed', key: 'a' }
		]) as SavePanelState

		expect(summarizeSaveProgress(state).groups[0].state).toBe('failed')
	})

	it('is complete once saved, even with nothing to upload', () => {
		const state = fold([
			{ type: 'preparing' },
			{ type: 'committing' },
			{ type: 'saved', unchanged: true }
		]) as SavePanelState

		expect(state.status).toBe('unchanged')
		expect(summarizeSaveProgress(state).percent).toBe(100)
	})
})

describe('a publish', () => {
	const stepStates = (state: SavePanelState | null) =>
		state?.publish?.steps.map((step) => `${step.key}:${step.state}`)

	it('shows the save it runs first, then hands over to its own steps', () => {
		const state = fold([
			{ type: 'publish-started', saves: true },
			{ type: 'preparing' },
			file('scene.gltf', 10),
			{ type: 'file-done', key: 'scene.gltf', reused: false },
			{ type: 'committing' },
			{ type: 'saved', unchanged: false }
		])

		expect(state?.status).toBe('publishing')
		expect(state?.files).toHaveLength(1)
		expect(stepStates(state)).toEqual([
			'export:waiting',
			'upload:waiting',
			'commit:waiting'
		])
		expect(saveStepStatus(state!)).toBe('saved')
	})

	it('runs its steps in order and lists textures only when they encode', () => {
		const state = fold([
			{ type: 'publish-started', saves: false },
			{ type: 'publish-step', key: 'export' },
			{ type: 'publish-step', key: 'textures', done: 1, total: 4 }
		])

		expect(stepStates(state)).toEqual([
			'export:done',
			'textures:active',
			'upload:waiting',
			'commit:waiting'
		])
		const summary = summarizeSaveProgress(state!)
		expect(summary.activeStep?.key).toBe('textures')
		expect(summary.percent).toBe(25)
	})

	it('has no percent while a step cannot say how far it has come', () => {
		const state = fold([
			{ type: 'publish-started', saves: false },
			{ type: 'publish-step', key: 'export' }
		])

		expect(summarizeSaveProgress(state!).percent).toBeNull()
	})

	it('finishes every step once published', () => {
		const state = fold([
			{ type: 'publish-started', saves: false },
			{ type: 'publish-step', key: 'upload', done: 5, total: 10 },
			{ type: 'published' }
		])

		expect(state?.status).toBe('published')
		expect(stepStates(state)).toEqual([
			'export:done',
			'upload:done',
			'commit:done'
		])
		expect(summarizeSaveProgress(state!).percent).toBe(100)
	})

	it('marks the running step when it fails, and the save as done', () => {
		const state = fold([
			{ type: 'publish-started', saves: true },
			{ type: 'preparing' },
			{ type: 'saved', unchanged: false },
			{ type: 'publish-step', key: 'upload', done: 1, total: 10 },
			{ type: 'publish-failed', message: 'Network' }
		])

		expect(state?.message).toBe('Network')
		expect(stepStates(state)).toEqual([
			'export:done',
			'upload:failed',
			'commit:waiting'
		])
		expect(saveStepStatus(state!)).toBe('saved')
	})

	it('stays a publish when its save fails and the publish then reports it', () => {
		const state = fold([
			{ type: 'publish-started', saves: true },
			{ type: 'preparing' },
			{ type: 'failed', message: 'Quota' },
			{ type: 'publish-failed', message: 'Quota' }
		])

		expect(state).toMatchObject({ status: 'failed', message: 'Quota' })
		expect(state?.publish).toBeDefined()
		expect(saveStepStatus(state!)).toBe('failed')
	})

	it('reads as not saved when its save fails', () => {
		const state = fold([
			{ type: 'publish-started', saves: true },
			{ type: 'preparing' },
			{ type: 'failed', message: 'Quota' }
		])

		expect(saveStepStatus(state!)).toBe('failed')
	})

	it('lets the next plain save start over once it has finished', () => {
		const published = fold([
			{ type: 'publish-started', saves: false },
			{ type: 'published' }
		])

		expect(fold([{ type: 'preparing' }], published)).toEqual({
			status: 'preparing',
			files: [],
			message: null
		})
	})

	it('counts as in flight until it ends', () => {
		const running = fold([
			{ type: 'publish-started', saves: false },
			{ type: 'publish-step', key: 'export' }
		])

		expect(isSaveInFlight(running)).toBe(true)
		expect(isSaveInFlight(fold([{ type: 'published' }], running))).toBe(false)
	})
})
