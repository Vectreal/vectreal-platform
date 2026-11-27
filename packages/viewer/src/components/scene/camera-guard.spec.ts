import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import {
	CAMERA_GUARD_MARGIN,
	entersModel,
	guardBox,
	isInsideGuard
} from './camera-guard'

const model = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1))
const margin = Math.sqrt(12) * CAMERA_GUARD_MARGIN

describe('entersModel', () => {
	it('is true for a move that ends inside the model', () => {
		expect(
			entersModel(new Vector3(0, 0, 3), new Vector3(0, 0, 0.5), model)
		).toBe(true)
	})

	it('is true for one that ends in the margin around it', () => {
		expect(
			entersModel(
				new Vector3(0, 0, 3),
				new Vector3(0, 0, 1 + margin / 2),
				model
			)
		).toBe(true)
	})

	it('is true for a step straight through a thin model', () => {
		const sign = new Box3(new Vector3(-1, -1, -0.01), new Vector3(1, 1, 0.01))
		expect(entersModel(new Vector3(0, 0, 2), new Vector3(0, 0, -2), sign)).toBe(
			true
		)
	})

	it('is false for a move that stays outside, past the model or not', () => {
		expect(entersModel(new Vector3(0, 0, 3), new Vector3(0, 0, 2), model)).toBe(
			false
		)
		expect(
			entersModel(new Vector3(3, 0, 3), new Vector3(3, 0, -3), model)
		).toBe(false)
	})

	it('judges a move from inside the margin against the model itself', () => {
		const close = new Vector3(0, 0, 1 + margin / 2)
		expect(entersModel(close, new Vector3(0, 0, 1 + margin / 3), model)).toBe(
			false
		)
		expect(entersModel(close, new Vector3(0, 0, 0.9), model)).toBe(true)
	})

	it('is false without a model', () => {
		expect(
			entersModel(new Vector3(0, 0, 3), new Vector3(0, 0, 0.5), new Box3())
		).toBe(false)
	})
})

describe('guardBox', () => {
	it('grows the model by the margin', () => {
		expect(guardBox(model).max.z).toBeCloseTo(1 + margin)
	})
})

describe('isInsideGuard', () => {
	it('is true only for a pose inside the model itself', () => {
		expect(isInsideGuard(new Vector3(0, 0, 0.5), model)).toBe(true)
		expect(isInsideGuard(new Vector3(0, 0, 1 + margin / 2), model)).toBe(false)
		expect(isInsideGuard(new Vector3(), new Box3())).toBe(false)
	})
})
