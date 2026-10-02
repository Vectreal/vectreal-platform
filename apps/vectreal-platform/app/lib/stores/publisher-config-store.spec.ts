/**
 * The publisher's "which tool is active" predicate.
 *
 * This exists because the answer was written by hand three times and one copy
 * got it wrong: the hotspot editor asked `activeComposeTool === 'hotspots'` and
 * kept its gizmo, its click-to-select and its click-to-place alive after the
 * author had closed the drawer - the tool bar stopped highlighting the button
 * while the canvas went on offering the tool. A scene tool has to be scoped to
 * its tool, so the predicate lives in one place and is pinned here.
 */
import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'

import {
	enterPreviewModeAtom,
	exitPreviewModeAtom,
	isPreviewModeAtom,
	openComposeToolAtom,
	processAtom,
	processInitialState
} from './publisher-config-store'

import type { ProcessState } from '../../types/publisher-config'

const storeWith = (overrides: Partial<ProcessState>) => {
	const store = createStore()
	store.set(processAtom, { ...processInitialState, ...overrides })
	return store
}

describe('openComposeToolAtom', () => {
	it('names the tool whose panel is open', () => {
		const store = storeWith({
			mode: 'compose',
			activeComposeTool: 'hotspots',
			showSidebar: true
		})

		expect(store.get(openComposeToolAtom)).toBe('hotspots')
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
		expect(store.get(openComposeToolAtom)).toBeNull()
	})

	it('goes null outside compose mode', () => {
		const store = storeWith({
			mode: 'optimize',
			activeComposeTool: 'hotspots',
			showSidebar: true
		})

		expect(store.get(openComposeToolAtom)).toBeNull()
	})

	it('names no tool before the author has opened one', () => {
		// The default is a real tool, not null, which is the other half of the trap.
		const store = createStore()

		expect(processInitialState.activeComposeTool).toBe('environment')
		expect(store.get(openComposeToolAtom)).toBeNull()
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

		expect(store.get(openComposeToolAtom)).toBe('shadow')
	})
})

/**
 * Preview mode can be entered from anywhere, so leaving it has to put the
 * publisher back the way the author had it. It used to reopen the Camera tool
 * whatever had been open, because the only way in was the Camera tool.
 */
describe('preview mode', () => {
	it('closes every panel on the way in', () => {
		const store = storeWith({
			mode: 'compose',
			activeComposeTool: 'hotspots',
			showSidebar: true
		})

		store.set(enterPreviewModeAtom)

		expect(store.get(isPreviewModeAtom)).toBe(true)
		expect(store.get(processAtom).showSidebar).toBe(false)
		expect(store.get(processAtom).showPublishPanel).toBe(false)
	})

	it('reopens the tool that was open before', () => {
		const store = storeWith({
			mode: 'compose',
			activeComposeTool: 'hotspots',
			showSidebar: true
		})

		store.set(enterPreviewModeAtom)
		store.set(exitPreviewModeAtom)

		expect(store.get(isPreviewModeAtom)).toBe(false)
		expect(store.get(openComposeToolAtom)).toBe('hotspots')
	})

	it('reopens the publish panel when that was what was open', () => {
		const store = storeWith({ showPublishPanel: true })

		store.set(enterPreviewModeAtom)
		store.set(exitPreviewModeAtom)

		expect(store.get(processAtom).showPublishPanel).toBe(true)
	})

	it('keeps the first snapshot when entered twice', () => {
		const store = storeWith({
			mode: 'compose',
			activeComposeTool: 'shadow',
			showSidebar: true
		})

		store.set(enterPreviewModeAtom)
		// A second entry sees the closed panels and must not record them.
		store.set(enterPreviewModeAtom)
		store.set(exitPreviewModeAtom)

		expect(store.get(openComposeToolAtom)).toBe('shadow')
	})
})
