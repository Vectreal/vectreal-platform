// @vitest-environment jsdom
/**
 * Deleting a marker or relinking it can retire the camera it owned, and an
 * interaction that switched to that camera has to go with it: the server
 * refuses an `activate_camera` naming a camera that is gone.
 */
import { act, renderHook } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it, vi } from 'vitest'

import { useHotspotEdits } from './use-hotspot-edits'
import {
	cameraAtom,
	hotspotsAtom,
	interactionsAtom
} from '../../../../../lib/stores/scene-settings-store'

import type { SceneInteractionDefinition } from '@vctrl/core'
import type { ReactNode } from 'react'

const { toastInfo } = vi.hoisted(() => ({ toastInfo: vi.fn() }))
vi.mock('sonner', () => ({ toast: { info: toastInfo } }))

vi.mock('../../../publisher-viewer-capture-context', () => ({
	usePublisherViewerCapture: () => ({
		requestSceneCameraSnapshot: () => Promise.resolve(null)
	})
}))

const HOTSPOT_ID = '00000000-0000-4000-8000-000000000001'

const switchTo = (
	id: string,
	cameraId: string
): SceneInteractionDefinition => ({
	id,
	trigger: { source: 'viewer', type: 'viewer_ready' },
	actions: [{ type: 'activate_camera', cameraId }]
})

function arrange() {
	toastInfo.mockClear()
	const store = createStore()
	store.set(cameraAtom, {
		cameras: [
			{ cameraId: 'front', name: 'Front', kind: 'scene', initial: true },
			// Minted with the marker and never framed, so a relink strands it.
			{
				cameraId: 'knob-camera',
				name: 'Knob Camera',
				kind: 'hotspot',
				position: [4, 2, 6]
			}
		]
	})
	store.set(hotspotsAtom, [
		{
			id: HOTSPOT_ID,
			name: 'Knob',
			worldPosition: [0, 0, 0],
			visible: true,
			internalOnly: false,
			stylePreset: 'dot',
			linkedCameraId: 'knob-camera'
		}
	])
	store.set(interactionsAtom, [
		switchTo('to-knob', 'knob-camera'),
		switchTo('to-front', 'front')
	])

	const wrapper = ({ children }: { children: ReactNode }) => (
		<Provider store={store}>{children}</Provider>
	)
	const { result } = renderHook(() => useHotspotEdits(), { wrapper })
	return { store, edits: () => result.current }
}

const interactionIds = (store: ReturnType<typeof createStore>) =>
	store.get(interactionsAtom)?.map((interaction) => interaction.id)

describe('useHotspotEdits and interactions', () => {
	it('drops the interactions that switched to a deleted marker’s camera', () => {
		const { store, edits } = arrange()

		act(() => {
			edits().remove(HOTSPOT_ID)
		})

		expect(interactionIds(store)).toEqual(['to-front'])
		expect(toastInfo).toHaveBeenCalledWith(
			'Camera deleted. 1 interaction no longer switches to it.'
		)
	})

	it('says nothing when the retired camera had no interactions', () => {
		const { store, edits } = arrange()
		act(() => {
			store.set(interactionsAtom, [switchTo('to-front', 'front')])
		})

		act(() => {
			edits().remove(HOTSPOT_ID)
		})

		expect(toastInfo).not.toHaveBeenCalled()
	})

	it('drops the interactions that switched to a camera a relink stranded', () => {
		const { store, edits } = arrange()

		act(() => {
			edits().relink(HOTSPOT_ID, 'front')
		})

		expect(store.get(cameraAtom).cameras?.map((c) => c.cameraId)).toEqual([
			'front'
		])
		expect(interactionIds(store)).toEqual(['to-front'])
		expect(toastInfo).toHaveBeenCalledWith(
			'Camera deleted. 1 interaction no longer switches to it.'
		)
	})
})
