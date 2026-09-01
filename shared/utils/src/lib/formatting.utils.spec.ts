/**
 * The one byte formatter, pinned at the edges the three it replaced disagreed on.
 *
 * They diverged exactly where nothing was asserted: above a gigabyte, below a
 * kilobyte, at the rounding boundaries, and on "not measured". A scene could
 * report three different sizes on one page and every suite stayed green.
 */

import { describe, expect, it } from 'vitest'

import { formatFileSize } from './formatting.utils'

const KB = 1024
const MB = 1024 * KB
const GB = 1024 * MB
const TB = 1024 * GB

describe('formatFileSize', () => {
	it('names every unit it can reach', () => {
		/*
		  GB is the case that mattered: this function used to stop at MB, so a 3 GiB
		  scene - which the plan limits allow - rendered as "3072.00 MB".
		*/
		expect(formatFileSize(512)).toBe('512 B')
		expect(formatFileSize(4 * KB)).toBe('4.0 KB')
		expect(formatFileSize(4 * MB)).toBe('4.0 MB')
		expect(formatFileSize(3 * GB)).toBe('3.0 GB')
		expect(formatFileSize(2 * TB)).toBe('2.0 TB')
	})

	it('clamps rather than running off the end of its units', () => {
		/*
		  A petabyte. The copy in `scene-asset-list-item.tsx` indexed an array of
		  four by an unbounded logarithm and rendered "1.0 undefined".
		*/
		expect(formatFileSize(1024 * TB)).toBe('1024 TB')
	})

	it('spends decimals where they carry information', () => {
		// Under 10: one decimal is the difference between 4.4 and 4 MB.
		expect(formatFileSize(4.4 * MB)).toBe('4.4 MB')
		// 10 to 100: the decimal is noise.
		expect(formatFileSize(48.6 * MB)).toBe('49 MB')
		// At or above 100: so is the fraction.
		expect(formatFileSize(150.7 * MB)).toBe('151 MB')
	})

	it('crosses into the next unit rather than counting past it', () => {
		/* 1023.9 KB is still KB; one byte more is not. */
		expect(formatFileSize(MB - 1)).toBe('1024 KB')
		expect(formatFileSize(MB)).toBe('1.0 MB')
	})

	it('distinguishes an empty file from an unmeasured one', () => {
		/*
		  Both used to be spelled by hand at each call site, and two of the three
		  formatters got one of them wrong. Zero is a fact; null is the absence of
		  one, and they must not render the same.
		*/
		expect(formatFileSize(0)).toBe('0 B')
		expect(formatFileSize(null)).toBe('-')
		expect(formatFileSize(undefined)).toBe('-')
		expect(formatFileSize(Number.NaN)).toBe('-')
	})
})
