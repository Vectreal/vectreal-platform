import { describe, expect, it } from 'vitest'

import {
	NORMALIZATION_DEFAULT_MAX_SIZE,
	NORMALIZATION_DEFAULT_MIN_SIZE,
	resolveNormalizedScale
} from './resolve-normalized-scale'

const enabled = { enabled: true }

describe('resolveNormalizedScale', () => {
	it('scales a model up to the lower bound', () => {
		expect(resolveNormalizedScale(0.1, enabled)).toBeCloseTo(5, 10)
	})

	it('scales a model down to the upper bound', () => {
		expect(resolveNormalizedScale(50, enabled)).toBeCloseTo(0.1, 10)
	})

	it.each([
		['at the lower bound', NORMALIZATION_DEFAULT_MIN_SIZE],
		['inside the range', 2],
		['at the upper bound', NORMALIZATION_DEFAULT_MAX_SIZE]
	])('leaves a model %s alone', (_label, diagonal) => {
		expect(resolveNormalizedScale(diagonal, enabled)).toBe(1)
	})

	it('honours bounds the caller supplies over the defaults', () => {
		expect(resolveNormalizedScale(50, { enabled: true, maxSize: 10 })).toBeCloseTo(
			0.2,
			10
		)
	})

	it.each([
		['normalization is off', 50, { enabled: false }],
		['there are no options', 50, undefined],
		['the model has no size', 0, enabled],
		['the diagonal is negative', -1, enabled],
		['the diagonal is NaN', Number.NaN, enabled],
		['the diagonal is infinite', Number.POSITIVE_INFINITY, enabled]
	])('applies no scale when %s', (_label, diagonal, options) => {
		expect(resolveNormalizedScale(diagonal, options)).toBe(1)
	})
})
