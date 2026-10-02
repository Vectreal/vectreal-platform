/**
 * The frame is measured once per model, not once per object.
 *
 * An optimization pass hands the viewer a new object whose bounds can differ
 * slightly from the one it replaces (simplification moves vertices). Measuring
 * that object again would change the normalization scale and the centering
 * under the user's camera, which is exactly the jump a key exists to prevent.
 */
import { BoxGeometry, Mesh } from 'three'
import { describe, expect, it } from 'vitest'

import { nextModelFrame } from './model-frame'

const boxModel = (size: number) => new Mesh(new BoxGeometry(size, size, size))

describe('nextModelFrame', () => {
	it('keeps the frame for a new object under the same key', () => {
		const first = nextModelFrame(null, boxModel(1), 7)
		const next = nextModelFrame(first, boxModel(3), 7)

		expect(next).toBe(first)
	})

	it('measures again under a new key', () => {
		const first = nextModelFrame(null, boxModel(1), 7)
		const next = nextModelFrame(first, boxModel(3), 8)

		expect(next).not.toBe(first)
		expect(next?.rawDiagonal).toBeCloseTo(Math.sqrt(27))
	})

	it('treats every new object as a new model when there is no key', () => {
		const model = boxModel(1)
		const first = nextModelFrame(null, model, undefined)

		expect(nextModelFrame(first, model, undefined)).toBe(first)
		expect(nextModelFrame(first, boxModel(1), undefined)).not.toBe(first)
	})

	it('has no frame without a model', () => {
		expect(nextModelFrame(null, null, 7)).toBeNull()
	})
})
