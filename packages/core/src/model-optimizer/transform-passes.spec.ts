/**
 * A transform pass called before any model is loaded says so. With no
 * document to read it would otherwise find nothing to do and resolve, which a
 * caller reads as a pass that ran.
 */
import { describe, expect, it } from 'vitest'

import { ModelOptimizer } from './model-optimizer'

describe('ModelOptimizer transform passes', () => {
	it.each([
		['simplify', (optimizer: ModelOptimizer) => optimizer.simplify()],
		['deduplicate', (optimizer: ModelOptimizer) => optimizer.deduplicate()],
		['quantize', (optimizer: ModelOptimizer) => optimizer.quantize()],
		[
			'optimizeNormals',
			(optimizer: ModelOptimizer) => optimizer.optimizeNormals()
		]
	])('%s refuses to run before a model is loaded', async (_, pass) => {
		const optimizer = new ModelOptimizer()

		await expect(pass(optimizer)).rejects.toThrow('No model loaded')
		expect(optimizer.getAppliedOptimizations()).toEqual([])
	})
})
