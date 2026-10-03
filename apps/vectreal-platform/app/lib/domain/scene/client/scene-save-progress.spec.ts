import { describe, expect, it } from 'vitest'

import {
	reduceSaveProgress,
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
