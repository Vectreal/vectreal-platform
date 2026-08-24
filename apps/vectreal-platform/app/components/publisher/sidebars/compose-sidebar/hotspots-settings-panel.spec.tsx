// @vitest-environment jsdom
/**
 * When the panel gives up the click-to-place arming it took.
 *
 * The arming lives in an atom, which outlives the panel that set it. Switching
 * compose tools unmounts the panel without deselecting anything, so the canvas
 * stayed armed under a tool that shows no placement affordance at all - and the
 * next click anywhere on the model moved a hotspot the author was no longer
 * editing.
 */

import { act, render } from '@testing-library/react'
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

describe('HotspotsSettingsPanel arming', () => {
	beforeEach(() => {
		store.set(hotspotsAtom, [])
		store.set(activeHotspotIdAtom, null)
		store.set(isClickToPlaceActiveAtom, false)
	})

	it('disarms click-to-place when the panel unmounts', () => {
		arrange()
		const { unmount } = render(<HotspotsSettingsPanel />)

		expect(store.get(isClickToPlaceActiveAtom)).toBe(true)

		unmount()

		expect(store.get(isClickToPlaceActiveAtom)).toBe(false)
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
