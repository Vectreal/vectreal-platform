import { describe, expect, it } from 'vitest'

import {
	fitsSizeBudget,
	MODEL_SIZE_BUDGET_BYTES,
	NORMALIZE_ATTEMPTS
} from './normalize-model-shared'

describe('normalize attempts', () => {
	it('starts from the model as generated', () => {
		expect(NORMALIZE_ATTEMPTS[0].simplifyRatio).toBe(1)
	})

	it('only ever gives up detail from one attempt to the next', () => {
		for (const [i, attempt] of NORMALIZE_ATTEMPTS.slice(1).entries()) {
			const previous = NORMALIZE_ATTEMPTS[i]
			expect(attempt.textureSize).toBeLessThanOrEqual(previous.textureSize)
			expect(attempt.simplifyRatio).toBeLessThanOrEqual(previous.simplifyRatio)
			expect(attempt).not.toEqual(previous)
		}
	})

	it('shrinks textures to the USDZ cap before it simplifies the mesh', () => {
		const firstSimplified = NORMALIZE_ATTEMPTS.find(
			(attempt) => attempt.simplifyRatio < 1
		)
		// three's USDZ exporter writes no texture larger than 1024 pixels.
		expect(firstSimplified?.textureSize).toBeLessThanOrEqual(1024)
	})
})

describe('fitsSizeBudget', () => {
	it('allows exactly 15 MB and nothing more', () => {
		expect(MODEL_SIZE_BUDGET_BYTES).toBe(15_000_000)
		expect(fitsSizeBudget(MODEL_SIZE_BUDGET_BYTES)).toBe(true)
		expect(fitsSizeBudget(MODEL_SIZE_BUDGET_BYTES + 1)).toBe(false)
	})
})
