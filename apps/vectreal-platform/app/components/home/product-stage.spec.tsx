// @vitest-environment jsdom
/**
 * The product window's one live stage: where it stands, and when it starts.
 *
 * Its canvas covers the whole window, so each view's place is made of two
 * boxes that must agree: the clip, which is the place itself, so the shadow
 * reaches its edges and stops there, and the frame the camera is fitted into,
 * the place less its margin, centered in it. It is a second WebGL renderer and
 * a parse of the hero's file, so it must not start before the window is on
 * screen, and once started it stays: the window cycles every few seconds, and
 * tearing it down each time round would parse the file again on every pass.
 */
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
	frameBox,
	placeClip,
	ProductStage,
	type FrameRect
} from './product-stage'
import { HOME_PAGE_COPY } from '../../constants/product-copy'

vi.mock('./embed-stage-client', () => ({
	default: () => <div>live stage</div>
}))

const PLACE: FrameRect = { x: 0.3, y: 0.4, w: 0.4, h: 0.3 }

const pct = (value: unknown) => Number(String(value).replace('%', '')) / 100

describe('placing the stage', () => {
	it('lets through exactly the place', () => {
		const [top, right, bottom, left] = (
			placeClip(PLACE).match(/inset\((.*)\)/) as RegExpMatchArray
		)[1]
			.split(' ')
			.map(pct)
		expect(left).toBeCloseTo(PLACE.x)
		expect(top).toBeCloseTo(PLACE.y)
		expect(1 - left - right).toBeCloseTo(PLACE.w)
		expect(1 - top - bottom).toBeCloseTo(PLACE.h)
	})

	it('fits the camera inside the place, centered on it', () => {
		const box = frameBox(PLACE)
		const left = pct(box.left)
		const top = pct(box.top)
		const width = pct(box.width)
		const height = pct(box.height)
		expect(left).toBeGreaterThan(PLACE.x)
		expect(top).toBeGreaterThan(PLACE.y)
		expect(left + width).toBeLessThan(PLACE.x + PLACE.w)
		expect(top + height).toBeLessThan(PLACE.y + PLACE.h)
		expect(left + width / 2).toBeCloseTo(PLACE.x + PLACE.w / 2)
		expect(top + height / 2).toBeCloseTo(PLACE.y + PLACE.h / 2)
	})
})

describe('the live stage', () => {
	it('stays out of the accessibility tree, hint included', () => {
		render(<ProductStage visible={false} place={PLACE} hint />)
		const hint = screen.getByText(HOME_PAGE_COPY.stage.status.live)
		expect(hint.closest('[aria-hidden="true"]')).not.toBeNull()
	})

	it('starts only once the window is on screen, then keeps running', async () => {
		const props = { place: PLACE, hint: true }
		const { rerender } = render(<ProductStage visible={false} {...props} />)
		await act(async () => {})
		expect(screen.queryByText('live stage')).toBeNull()

		rerender(<ProductStage visible {...props} />)
		expect(await screen.findByText('live stage')).toBeTruthy()

		rerender(<ProductStage visible={false} {...props} />)
		await act(async () => {})
		expect(screen.queryByText('live stage')).not.toBeNull()
	})
})
