import {
	chapterFadeRange,
	chapterIdByPos,
	chapterPosFromProgress
} from '../app/components/home/mock-shop-chapters'

describe('chapterPosFromProgress', () => {
	it('maps scroll progress linearly to a chapter position (last chapter at the end)', () => {
		expect(chapterPosFromProgress(0)).toBe(0)
		expect(chapterPosFromProgress(1 / 3)).toBeCloseTo(1)
		expect(chapterPosFromProgress(2 / 3)).toBeCloseTo(2)
		expect(chapterPosFromProgress(1)).toBe(3)
	})
	it('interpolates between chapters', () => {
		expect(chapterPosFromProgress(1 / 6)).toBeCloseTo(0.5)
		expect(chapterPosFromProgress(0.5)).toBeCloseTo(1.5)
	})
	it('clamps out-of-range progress', () => {
		expect(chapterPosFromProgress(2)).toBe(3)
		expect(chapterPosFromProgress(-1)).toBe(0)
	})
})

describe('chapterIdByPos', () => {
	it('rounds a fractional position to the nearest chapter id', () => {
		expect(chapterIdByPos(0)).toBe('default')
		expect(chapterIdByPos(0.4)).toBe('default')
		expect(chapterIdByPos(0.6)).toBe('side-view')
		expect(chapterIdByPos(2)).toBe('light-closeup')
		expect(chapterIdByPos(3)).toBe('back-side')
	})
	it('clamps out-of-range positions', () => {
		expect(chapterIdByPos(-2)).toBe('default')
		expect(chapterIdByPos(9)).toBe('back-side')
	})
})

describe('chapterFadeRange', () => {
	it('keeps offsets within [0,1] and monotonically increasing', () => {
		for (let i = 0; i <= 3; i++) {
			const { input, output } = chapterFadeRange(i, 0.12)
			expect(input.length).toBe(output.length)
			expect(input[0]).toBeGreaterThanOrEqual(0)
			expect(input[input.length - 1]).toBeLessThanOrEqual(1)
			for (let k = 1; k < input.length; k++) {
				expect(input[k]).toBeGreaterThan(input[k - 1])
			}
		}
	})
	it('peaks at 1 when the chapter is centered', () => {
		// first chapter starts lit at progress 0
		expect(chapterFadeRange(0, 0.12).output[0]).toBe(1)
		// last chapter ends lit at progress 1
		const last = chapterFadeRange(3, 0.12)
		expect(last.input[last.input.length - 1]).toBe(1)
		expect(last.output[last.output.length - 1]).toBe(1)
	})
})
