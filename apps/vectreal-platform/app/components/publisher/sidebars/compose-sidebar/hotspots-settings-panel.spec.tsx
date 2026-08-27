// @vitest-environment jsdom
/**
 * The panel's two contracts with state that outlives it: the click-to-place
 * arming it takes from an atom, and the playback order it writes back.
 *
 * The arming lives in an atom, which outlives the panel that set it. Switching
 * compose tools unmounts the panel without deselecting anything, so the canvas
 * stayed armed under a tool that shows no placement affordance at all - and the
 * next click anywhere on the model moved a hotspot the author was no longer
 * editing.
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { getDefaultStore } from 'jotai'
import { describe, expect, it, beforeEach } from 'vitest'

import HotspotsSettingsPanel from './hotspots-settings-panel'
import { isClickToPlaceActiveAtom } from '../../../../lib/stores/publisher-config-store'
import {
	activeHotspotIdAtom,
	cameraAtom,
	hotspotsAtom
} from '../../../../lib/stores/scene-settings-store'

import type { HotspotDefinition } from '@vctrl/core'

const store = getDefaultStore()

const hotspot: HotspotDefinition = {
	id: '00000000-0000-4000-8000-000000000001',
	name: 'Nose cone',
	worldPosition: [1, 2, 3],
	visible: true,
	internalOnly: false,
	occlusionEnabled: true,
	stylePreset: 'dot',
	linkedCameraId: 'hotspot-camera-1'
}

const arrange = () => {
	store.set(hotspotsAtom, [hotspot])
	store.set(activeHotspotIdAtom, hotspot.id)
	store.set(cameraAtom, {
		cameras: [
			{
				cameraId: 'hotspot-camera-1',
				kind: 'hotspot',
				name: 'Nose cone Camera'
			}
		]
	})
	store.set(isClickToPlaceActiveAtom, true)
}

/** A sequence of `count` markers, all in the playback order, numbered from zero. */
const sequence = (count: number): HotspotDefinition[] =>
	Array.from({ length: count }, (_, index) => ({
		...hotspot,
		id: `0000000${index}-0000-4000-8000-000000000001`,
		name: `Marker ${index + 1}`,
		sequenceIndex: index,
		linkedCameraId: undefined
	}))

const orderOfNames = () =>
	store
		.get(hotspotsAtom)
		.filter((entry) => entry.sequenceIndex !== undefined)
		.sort((a, b) => (a.sequenceIndex as number) - (b.sequenceIndex as number))
		.map((entry) => entry.name)

/**
 * The live announcement. Two regions are rendered and used alternately so a
 * repeated message still counts as a change, so the live one is whichever has
 * text.
 */
const announcement = () =>
	screen
		.getAllByRole('status')
		.map((region) => region.textContent)
		.filter(Boolean)
		.join('')

const handleFor = (name: string) =>
	screen.getByRole('button', { name: `Reorder ${name}` })

const rowTriggers = () =>
	screen
		.getAllByRole('button')
		.filter((element) => element.hasAttribute('aria-expanded'))

beforeEach(() => {
	store.set(hotspotsAtom, [])
	store.set(activeHotspotIdAtom, null)
	store.set(isClickToPlaceActiveAtom, false)
	store.set(cameraAtom, { cameras: [] })
})

describe('HotspotsSettingsPanel arming', () => {
	it('disarms click-to-place when the panel unmounts', () => {
		arrange()
		const { unmount } = render(<HotspotsSettingsPanel />)

		expect(store.get(isClickToPlaceActiveAtom)).toBe(true)

		unmount()

		expect(store.get(isClickToPlaceActiveAtom)).toBe(false)
	})

	/**
	 * The selection is the other half of the same defect the arming cleanup was
	 * written for, one atom over: `activeHotspotIdAtom` is what puts the transform
	 * gizmo on the canvas, and it outlives the panel too. Closing the tool drawer
	 * left a gizmo floating over the model with no panel to explain it and no way
	 * to dismiss it short of reopening the tool.
	 */
	it('drops the selection when the panel unmounts', () => {
		arrange()
		const { unmount } = render(<HotspotsSettingsPanel />)

		expect(store.get(activeHotspotIdAtom)).toBe(hotspot.id)

		unmount()

		expect(store.get(activeHotspotIdAtom)).toBeNull()
	})

	/**
	 * The `act` is load-bearing, not ceremony. Setting the atom from outside it
	 * leaves the re-render deferred, and the assertion then passes only because
	 * some later call happens to flush it - which is what an incidental
	 * `rerender()` was doing here before.
	 */
	it('disarms click-to-place when the hotspot is deselected', () => {
		arrange()
		render(<HotspotsSettingsPanel />)

		expect(store.get(isClickToPlaceActiveAtom)).toBe(true)

		act(() => {
			store.set(activeHotspotIdAtom, null)
		})

		expect(store.get(isClickToPlaceActiveAtom)).toBe(false)
	})

	it('leaves the arming alone while a hotspot stays selected', () => {
		arrange()
		render(<HotspotsSettingsPanel />)

		// Settle every effect the mount queued: the deselect branch runs on mount
		// too, and would disarm here if it read the selection wrongly.
		act(() => {})

		expect(store.get(isClickToPlaceActiveAtom)).toBe(true)
	})
})

describe('HotspotsSettingsPanel selection', () => {
	/**
	 * Being open is being selected. Nothing else marks the row, so a disclosure
	 * that does not reach the atom leaves the canvas gizmo pointed elsewhere.
	 */
	it('selects the hotspot whose row is expanded', () => {
		store.set(hotspotsAtom, sequence(2))
		render(<HotspotsSettingsPanel />)

		act(() => {
			fireEvent.click(rowTriggers()[1])
		})

		expect(store.get(activeHotspotIdAtom)).toBe(sequence(2)[1].id)
	})

	it('opens at most one row at a time', () => {
		store.set(hotspotsAtom, sequence(3))
		render(<HotspotsSettingsPanel />)

		act(() => {
			fireEvent.click(rowTriggers()[0])
		})
		act(() => {
			fireEvent.click(rowTriggers()[2])
		})

		expect(
			rowTriggers().filter(
				(trigger) => trigger.getAttribute('aria-expanded') === 'true'
			)
		).toHaveLength(1)
	})

	/**
	 * `DynamicSidebar` already draws "Hotspots" and the tool's description above
	 * this panel, so a section of the same name printed the word twice.
	 */
	it('draws no heading of its own repeating the tool name', () => {
		store.set(hotspotsAtom, sequence(1))
		render(<HotspotsSettingsPanel />)

		expect(screen.queryByRole('heading', { name: 'Hotspots' })).toBeNull()
		expect(screen.getByRole('heading', { name: 'Markers' })).toBeTruthy()
	})

	it('offers the asset field only for a preset that needs one', () => {
		store.set(hotspotsAtom, [{ ...hotspot, sequenceIndex: 0 }])
		store.set(activeHotspotIdAtom, hotspot.id)
		const { rerender } = render(<HotspotsSettingsPanel />)

		expect(screen.queryByLabelText('Asset URL')).toBeNull()

		act(() => {
			store.set(hotspotsAtom, [
				{ ...hotspot, sequenceIndex: 0, stylePreset: 'image' }
			])
		})
		rerender(<HotspotsSettingsPanel />)

		expect(screen.getByLabelText('Asset URL')).toBeTruthy()
	})
})

describe('HotspotsSettingsPanel ordering', () => {
	it('moves a marker one step down the sequence', () => {
		store.set(hotspotsAtom, sequence(3))
		render(<HotspotsSettingsPanel />)

		act(() => {
			fireEvent.keyDown(handleFor('Marker 1'), { key: 'ArrowDown' })
		})

		expect(orderOfNames()).toEqual(['Marker 2', 'Marker 1', 'Marker 3'])
	})

	it('moves a marker one step up the sequence', () => {
		store.set(hotspotsAtom, sequence(3))
		render(<HotspotsSettingsPanel />)

		act(() => {
			fireEvent.keyDown(handleFor('Marker 3'), { key: 'ArrowUp' })
		})

		expect(orderOfNames()).toEqual(['Marker 1', 'Marker 3', 'Marker 2'])
	})

	/**
	 * Silence at an end is indistinguishable from a key that does nothing, so
	 * the refusal is spoken rather than swallowed.
	 */
	it('refuses a move at the ends, and says so', () => {
		store.set(hotspotsAtom, sequence(3))
		render(<HotspotsSettingsPanel />)

		act(() => {
			fireEvent.keyDown(handleFor('Marker 1'), { key: 'ArrowUp' })
		})

		expect(orderOfNames()).toEqual(['Marker 1', 'Marker 2', 'Marker 3'])
		expect(announcement()).toBe('Marker 1 is already first.')
	})

	/**
	 * "Position", not "step". The badge on a row is what a visitor is shown, and
	 * `resolveHotspotMarkers` ranks that over the markers a visitor can reach.
	 * This list is the authoring order and counts hidden members too, so one
	 * word for both would announce a number that is on screen nowhere.
	 */
	it('announces a move in authoring positions, not visitor steps', () => {
		const [first, second, third] = sequence(3)
		store.set(hotspotsAtom, [{ ...first, visible: false }, second, third])
		render(<HotspotsSettingsPanel />)

		act(() => {
			fireEvent.keyDown(handleFor('Marker 3'), { key: 'ArrowUp' })
		})

		expect(announcement()).toBe('Marker 3 moved to position 2 of 3.')
	})

	it('sends a marker to the end of the sequence', () => {
		store.set(hotspotsAtom, sequence(3))
		render(<HotspotsSettingsPanel />)

		act(() => {
			fireEvent.keyDown(handleFor('Marker 1'), { key: 'End' })
		})

		expect(orderOfNames()).toEqual(['Marker 2', 'Marker 3', 'Marker 1'])
	})

	/**
	 * A reorder that leaves focus on the document body strands a keyboard user
	 * mid-sequence: the next arrow press goes nowhere and the list has to be
	 * tabbed back into. React keeps the node only while the key is the id.
	 */
	it('keeps focus on the handle it was moved with', () => {
		store.set(hotspotsAtom, sequence(3))
		render(<HotspotsSettingsPanel />)

		const handle = handleFor('Marker 1')
		handle.focus()

		act(() => {
			fireEvent.keyDown(handle, { key: 'ArrowDown' })
		})

		expect(document.activeElement).toBe(handleFor('Marker 1'))
	})

	it('announces where the marker landed', () => {
		store.set(hotspotsAtom, sequence(3))
		render(<HotspotsSettingsPanel />)

		act(() => {
			fireEvent.keyDown(handleFor('Marker 1'), { key: 'ArrowDown' })
		})

		expect(announcement()).toBe('Marker 1 moved to position 2 of 3.')
	})

	/**
	 * A hidden marker is still in the sequence; it just carries no step, which
	 * is why its badge is a dash. Announcing that as "not in the sequence"
	 * contradicted both the group it sits in and its own switch.
	 */
	it('keeps a hidden marker in the sequence it belongs to', () => {
		const [first, second] = sequence(2)
		store.set(hotspotsAtom, [{ ...first, visible: false }, second])
		render(<HotspotsSettingsPanel />)

		const rows = screen.getAllByRole('listitem')

		expect(
			within(rows[0]).getByText(
				/in the sequence, no step in the published scene/
			)
		).toBeTruthy()
		expect(within(rows[0]).queryByText(/, not in the sequence/)).toBeNull()
	})

	/**
	 * "Hidden" is not the only reason a step is withheld: `resolveHotspotMarkers`
	 * also drops an editor-only marker. Saying "while hidden" for one whose
	 * "Visible to viewers" switch is on contradicts the switch.
	 */
	it('does not call an editor-only marker hidden', () => {
		const [first, second] = sequence(2)
		store.set(hotspotsAtom, [{ ...first, internalOnly: true }, second])
		render(<HotspotsSettingsPanel />)

		const rows = screen.getAllByRole('listitem')

		expect(within(rows[0]).getByText(/editor only/)).toBeTruthy()
		expect(within(rows[0]).queryByText(/hidden/)).toBeNull()
	})

	/**
	 * A live region speaks on mutation, and React bails out of an identical
	 * `setState`, so a refusal repeated verbatim used to speak once and then go
	 * quiet - the silence the refusal message exists to remove.
	 */
	it('repeats a refusal rather than falling silent', () => {
		store.set(hotspotsAtom, sequence(3))
		render(<HotspotsSettingsPanel />)

		const slots = () =>
			screen.getAllByRole('status').map((region) => region.textContent)

		// Three, not two: the first attempt at this alternated a trailing
		// zero-width space, which saturates on the third repeat and goes silent
		// again. A two-press test could not see that.
		const seen: string[][] = []
		for (let press = 0; press < 3; press += 1) {
			act(() => {
				fireEvent.keyDown(handleFor('Marker 1'), { key: 'ArrowUp' })
			})
			seen.push(slots())
			expect(announcement()).toBe('Marker 1 is already first.')
		}

		// Each press must land in a region that was empty, so every one of them
		// is an insertion rather than an unchanged node.
		expect(seen[0]).not.toEqual(seen[1])
		expect(seen[1]).not.toEqual(seen[2])
	})

	/**
	 * With one member `from` is always 0, so reading the end off the index
	 * announced "already first" for a press asking to go last.
	 */
	it('names the end the press was aiming for', () => {
		store.set(hotspotsAtom, sequence(1))
		render(<HotspotsSettingsPanel />)

		act(() => {
			fireEvent.keyDown(handleFor('Marker 1'), { key: 'ArrowDown' })
		})

		expect(announcement()).toBe('Marker 1 is already last.')
	})

	/**
	 * Two genuine moves that happen to cancel out. Both are edits, so both are
	 * announced - the drag-released-where-it-began case, which is not reachable
	 * from the keyboard, is pinned on `applySequenceMove` instead.
	 */
	it('returns a marker to where it started, announcing each leg', () => {
		store.set(hotspotsAtom, sequence(3))
		render(<HotspotsSettingsPanel />)

		act(() => {
			fireEvent.keyDown(handleFor('Marker 1'), { key: 'ArrowDown' })
		})
		expect(announcement()).toBe('Marker 1 moved to position 2 of 3.')

		act(() => {
			fireEvent.keyDown(handleFor('Marker 1'), { key: 'ArrowUp' })
		})
		expect(announcement()).toBe('Marker 1 moved to position 1 of 3.')
		expect(orderOfNames()).toEqual(['Marker 1', 'Marker 2', 'Marker 3'])
	})

	/**
	 * The step on the row is the step a visitor is shown, and `@vctrl/viewer`
	 * ranks among the markers a visitor can reach rather than printing the
	 * stored index. A hidden marker holding slot 0 must not push the first
	 * reachable one to "2".
	 */
	it('numbers the steps a visitor will actually see', () => {
		const [first, second] = sequence(2)
		store.set(hotspotsAtom, [{ ...first, visible: false }, second])
		render(<HotspotsSettingsPanel />)

		const rows = screen.getAllByRole('listitem')

		expect(within(rows[0]).queryByText('1')).toBeNull()
		expect(within(rows[1]).getByText('1')).toBeTruthy()
	})

	/**
	 * Deleting removes a row, drops focus and renumbers every later step. A
	 * reorder one row up announces itself; saying nothing here read as an
	 * oversight rather than a decision.
	 */
	it('announces a deletion and what it left behind', () => {
		store.set(hotspotsAtom, sequence(3))
		render(<HotspotsSettingsPanel />)

		act(() => {
			fireEvent.click(screen.getByRole('button', { name: 'Delete Marker 2' }))
		})

		expect(announcement()).toBe(
			'Marker 2 deleted. 2 markers left in the sequence.'
		)
	})

	it('closes the gap a deleted marker leaves in the sequence', () => {
		store.set(hotspotsAtom, sequence(3))
		render(<HotspotsSettingsPanel />)

		act(() => {
			fireEvent.click(screen.getByRole('button', { name: 'Delete Marker 2' }))
		})

		expect(
			store.get(hotspotsAtom).map((entry) => [entry.name, entry.sequenceIndex])
		).toEqual([
			['Marker 1', 0],
			['Marker 3', 1]
		])
	})
})
