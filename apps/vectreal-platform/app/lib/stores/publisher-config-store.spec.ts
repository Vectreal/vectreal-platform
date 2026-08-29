/**
 * The publisher's "which tool is active" predicate.
 *
 * This exists because the answer was written by hand three times and one copy
 * got it wrong: the hotspot editor asked `activeComposeTool === 'hotspots'` and
 * kept its gizmo, its click-to-select and its click-to-place alive after the
 * author had closed the drawer - the tool rail stopped highlighting the button
 * while the canvas went on offering the tool. A scene tool has to be scoped to
 * its tool, so the predicate lives in one place and is pinned here.
 */
import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'

import {
	activeComposeToolAtom,
	processAtom,
	processInitialState
} from './publisher-config-store'

import type { ProcessState } from '../../types/publisher-config'

const storeWith = (overrides: Partial<ProcessState>) => {
	const store = createStore()
	store.set(processAtom, { ...processInitialState, ...overrides })
	return store
}

describe('activeComposeToolAtom', () => {
	it('names the tool whose panel is open', () => {
		const store = storeWith({
			mode: 'compose',
			activeComposeTool: 'hotspots',
			showSidebar: true
		})

		expect(store.get(activeComposeToolAtom)).toBe('hotspots')
	})

	it('goes null when the drawer closes, though the tool stays selected', () => {
		// Closing a tool flips `showSidebar` and leaves `activeComposeTool` exactly
		// where it was, which is the whole reason reading that field alone is wrong.
		const store = storeWith({
			mode: 'compose',
			activeComposeTool: 'hotspots',
			showSidebar: false
		})

		expect(store.get(processAtom).activeComposeTool).toBe('hotspots')
		expect(store.get(activeComposeToolAtom)).toBeNull()
	})

	it('goes null outside compose mode', () => {
		const store = storeWith({
			mode: 'optimize',
			activeComposeTool: 'hotspots',
			showSidebar: true
		})

		expect(store.get(activeComposeToolAtom)).toBeNull()
	})

	it('names no tool before the author has opened one', () => {
		// The default is a real tool, not null, which is the other half of the trap.
		const store = createStore()

		expect(processInitialState.activeComposeTool).toBe('environment')
		expect(store.get(activeComposeToolAtom)).toBeNull()
	})

	it('follows the author from one tool to the next', () => {
		const store = storeWith({
			mode: 'compose',
			activeComposeTool: 'hotspots',
			showSidebar: true
		})
		store.set(processAtom, (previous) => ({
			...previous,
			activeComposeTool: 'shadow'
		}))

		expect(store.get(activeComposeToolAtom)).toBe('shadow')
	})
})
