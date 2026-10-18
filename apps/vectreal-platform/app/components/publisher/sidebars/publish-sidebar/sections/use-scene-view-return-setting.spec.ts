// @vitest-environment jsdom
/**
 * The "Back to scene view" setting is offered only where a visitor can stand
 * on a hotspot view, and stores the author's choice as a presentation field.
 */
import { act, renderHook } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { useSceneViewReturnSetting } from './use-scene-view-return-setting'
import {
	cameraAtom,
	hotspotsAtom,
	presentationAtom
} from '../../../../../lib/stores/scene-settings-store'

import type { CameraConfig, HotspotDefinition } from '@vctrl/core'

const hotspot = (overrides: Partial<HotspotDefinition>): HotspotDefinition =>
	({
		id: 'knob',
		name: 'Knob',
		worldPosition: [0, 0, 0],
		...overrides
	}) as HotspotDefinition

function renderSetting(
	hotspots: HotspotDefinition[],
	cameras: CameraConfig[] = [
		{ cameraId: 'front', name: 'Front' },
		{ cameraId: 'knob-camera', kind: 'hotspot', name: 'Knob camera' }
	]
) {
	const store = createStore()
	store.set(cameraAtom, { cameras })
	store.set(hotspotsAtom, hotspots)
	const wrapper = ({ children }: { children: ReactNode }) =>
		createElement(Provider, { store }, children)
	const { result } = renderHook(() => useSceneViewReturnSetting(), { wrapper })
	return { result, store }
}

describe('useSceneViewReturnSetting', () => {
	it('is offered once a published hotspot has its own camera', () => {
		const { result } = renderSetting([
			hotspot({ linkedCameraId: 'knob-camera' })
		])
		expect(result.current.available).toBe(true)
	})

	it('is not offered when no hotspot has a camera', () => {
		expect(renderSetting([hotspot({})]).result.current.available).toBe(false)
	})

	it('does not count a camera only an internal hotspot links: visitors never get that marker', () => {
		const { result } = renderSetting([
			hotspot({ linkedCameraId: 'knob-camera', internalOnly: true })
		])
		expect(result.current.available).toBe(false)
	})

	it('does not count a hidden hotspot: visitors cannot click it', () => {
		const { result } = renderSetting([
			hotspot({ linkedCameraId: 'knob-camera', visible: false })
		])
		expect(result.current.available).toBe(false)
	})

	it('does not count a link to a camera that no longer exists', () => {
		const { result } = renderSetting([
			hotspot({ linkedCameraId: 'deleted-camera' })
		])
		expect(result.current.available).toBe(false)
	})

	it("does not count a link to one of the scene's own views", () => {
		// Tagged as a scene camera: linking it does not make it a close-up.
		const { result } = renderSetting(
			[hotspot({ linkedCameraId: 'front' })],
			[{ cameraId: 'front', kind: 'scene', name: 'Front' }]
		)
		expect(result.current.available).toBe(false)
	})

	it('is not offered when no scene view is left to go back to', () => {
		// An untagged camera a hotspot links is that hotspot's close-up to the
		// viewer, so this scene has nowhere to return and draws no control.
		const { result } = renderSetting(
			[hotspot({ linkedCameraId: 'default' })],
			[{ cameraId: 'default', name: 'Default' }]
		)
		expect(result.current.available).toBe(false)
	})

	it("counts on the embed's hotspots, where an internal link no longer claims a camera", () => {
		// The internal hotspot makes `default` a close-up in the editor; the
		// embed drops it, so `default` is the scene view the knob leads back to.
		const { result } = renderSetting(
			[
				hotspot({
					id: 'secret',
					linkedCameraId: 'default',
					internalOnly: true
				}),
				hotspot({ linkedCameraId: 'knob-camera' })
			],
			[
				{ cameraId: 'default', name: 'Default' },
				{ cameraId: 'knob-camera', kind: 'hotspot', name: 'Knob camera' }
			]
		)
		expect(result.current.available).toBe(true)
	})

	it('reads absent as shown, and stores the choice in presentation', () => {
		const { result, store } = renderSetting([
			hotspot({ linkedCameraId: 'knob-camera' })
		])
		expect(result.current.shown).toBe(true)

		act(() => result.current.setShown(false))

		expect(store.get(presentationAtom).showSceneViewReturn).toBe(false)
		expect(result.current.shown).toBe(false)
	})
})
