// @vitest-environment jsdom
/**
 * The toggle that rescales the model also moves the markers placed on it.
 *
 * The reason this exists rather than a comment: passing the same normalization
 * object for both scales - or reversing the two arguments - makes
 * `resolveNormalizedScale` return the same number twice, the re-anchor return by
 * identity, and the store write a no-op. The scale still changes, the markers
 * still detach, and nothing anywhere fails. That is the whole defect, restored
 * silently, so the wiring is driven through a real click against a real store.
 */

import { act, fireEvent, render, screen } from '@testing-library/react'
import { getDefaultStore } from 'jotai'
import { beforeEach, describe, expect, it } from 'vitest'

import { SceneNormalizationNotice } from './scene-normalization-notice'
import {
	cameraAtom,
	hotspotsAtom,
	normalizationAtom,
	rawModelDiagonalAtom
} from '../../../lib/stores/scene-settings-store'

import type { CameraConfig, HotspotDefinition } from '@vctrl/core'

const store = getDefaultStore()

/** Outside [0.5, 5], so the notice renders at all. */
const RAW_DIAGONAL = 50
/** What `resolveNormalizedScale` gives for that diagonal: 5 / 50. */
const ENABLED_SCALE = 0.1

const hotspot: HotspotDefinition = {
	id: '00000000-0000-4000-8000-000000000001',
	name: 'Nose cone',
	worldPosition: [10, 20, 30],
	visible: true,
	internalOnly: false,
	stylePreset: 'dot',
	linkedCameraId: 'cam-a'
}

const arrange = (enabled: boolean) => {
	store.set(rawModelDiagonalAtom, RAW_DIAGONAL)
	store.set(normalizationAtom, { enabled, minSize: 0.5, maxSize: 5 })
	store.set(hotspotsAtom, [
		{
			...hotspot,
			worldPosition: enabled ? [1, 2, 3] : [10, 20, 30]
		}
	])
	store.set(cameraAtom, {
		cameras: [
			{
				cameraId: 'cam-a',
				name: 'cam-a',
				kind: 'hotspot',
				target: enabled ? [1, 2, 3] : [10, 20, 30]
			}
		] as CameraConfig[]
	})
}

const click = (name: string) =>
	act(() => {
		fireEvent.click(screen.getByRole('button', { name }))
	})

const positionOf = () => store.get(hotspotsAtom)[0].worldPosition
const targetOf = () => store.get(cameraAtom).cameras?.[0].target

beforeEach(() => {
	store.set(hotspotsAtom, [])
	store.set(cameraAtom, { cameras: [] })
})

describe('SceneNormalizationNotice', () => {
	it('renders nothing for a model of unremarkable size', () => {
		arrange(false)
		store.set(rawModelDiagonalAtom, 2)

		const { container } = render(<SceneNormalizationNotice />)

		expect(container).toBeEmptyDOMElement()
	})

	it('moves the markers with the model when normalization is switched on', () => {
		arrange(false)
		render(<SceneNormalizationNotice />)

		click('Normalize size')

		expect(store.get(normalizationAtom).enabled).toBe(true)
		expect(positionOf()).toEqual([
			10 * ENABLED_SCALE,
			20 * ENABLED_SCALE,
			30 * ENABLED_SCALE
		])
	})

	it('turns the camera a moved marker owns', () => {
		arrange(false)
		render(<SceneNormalizationNotice />)

		click('Normalize size')

		expect(targetOf()).toEqual([1, 2, 3])
	})

	it('moves them back when normalization is reverted', () => {
		arrange(true)
		render(<SceneNormalizationNotice />)

		click('Revert to original size')

		expect(store.get(normalizationAtom).enabled).toBe(false)
		expect(positionOf()).toEqual([10, 20, 30])
		expect(targetOf()).toEqual([10, 20, 30])
	})
})
