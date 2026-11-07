/**
 * Two quick taps in one place are a double-tap; a drag, a slow second tap, or
 * one far from the first is not.
 */
import { describe, expect, it } from 'vitest'

import {
	DOUBLE_TAP_MS,
	isDoubleTap,
	isTap,
	TAP_MS,
	TAP_SLOP_PX
} from './double-tap'

const tap = (time: number, x = 100, y = 100) => ({ time, x, y })

describe('isTap', () => {
	it('is a finger lifted where it went down', () => {
		expect(isTap(tap(0), tap(80, 105, 103))).toBe(true)
	})

	it('is not a long press', () => {
		expect(isTap(tap(0), tap(TAP_MS + 1))).toBe(false)
	})

	it('is not the end of a drag', () => {
		expect(isTap(tap(0), tap(80, 100 + TAP_SLOP_PX + 1))).toBe(false)
	})
})

describe('isDoubleTap', () => {
	it('takes a second tap soon after and close to the first', () => {
		expect(isDoubleTap(tap(0), tap(DOUBLE_TAP_MS, 110, 95))).toBe(true)
	})

	it('needs a first tap', () => {
		expect(isDoubleTap(null, tap(0))).toBe(false)
	})

	it('refuses a second tap that came too late', () => {
		expect(isDoubleTap(tap(0), tap(DOUBLE_TAP_MS + 1))).toBe(false)
	})

	it('refuses a second tap somewhere else', () => {
		expect(isDoubleTap(tap(0), tap(100, 100 + TAP_SLOP_PX + 1))).toBe(false)
	})
})
