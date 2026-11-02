import { Document } from '@gltf-transform/core'
import { describe, expect, it, vi } from 'vitest'

import type { ScenePrimitive } from './scene-primitives'

/**
 * watlas carries xatlas as WebAssembly. Only a bake that lays out UVs may
 * load it: importing core, or either bake's entry, must not.
 */
const loaded = vi.hoisted(() => ({ watlas: false }))

vi.mock('watlas', () => {
	loaded.watlas = true
	return {
		Initialize: async () => {
			throw new Error('watlas initialized')
		}
	}
})

describe('watlas', () => {
	it('is not loaded by importing core or either bake', async () => {
		await import('../index')
		await import('./index')
		await import('../light-bake')

		expect(loaded.watlas).toBe(false)
	})

	it('is loaded when a layout is written', async () => {
		const { writeBakeUvs } = await import('./generated-uvs')
		const document = new Document()
		const primitive = document.createPrimitive()

		await expect(
			writeBakeUvs({
				texCoord: 1,
				materials: new Map(),
				primitives: [
					{
						primitive,
						worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
					} as ScenePrimitive
				]
			})
		).rejects.toThrow('watlas initialized')
		expect(loaded.watlas).toBe(true)
	})
})
