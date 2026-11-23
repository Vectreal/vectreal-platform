/**
 * A UV set laid out for the bake holds only the materials whose own UVs could
 * not take one, often a single small part such as a lens. Its map is sized by
 * how many materials it holds, so one part gets one material's map rather
 * than one sixteen times its size.
 */
import { Document } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'

import { layoutMapSize, sheetsOf } from './uv-trace'

import type { OcclusionBakeTarget } from './plan'

const targets = (onOwnUvs: number, onLayout: number): OcclusionBakeTarget[] => {
	const document = new Document()
	const target = (texCoord: number) => ({
		material: document.createMaterial(),
		primitives: [],
		texCoord
	})
	return [
		...Array.from({ length: onOwnUvs }, () => target(0)),
		...Array.from({ length: onLayout }, () => target(1))
	]
}

describe('the maps a bake draws', () => {
	it('gives a layout that holds one material one material’s map', () => {
		const sheets = sheetsOf(targets(3, 1), 512)
		expect(sheets.map(({ texCoord, size }) => [texCoord, size])).toEqual([
			[0, 512],
			[0, 512],
			[0, 512],
			[1, 512]
		])
	})

	it('grows a layout’s map with the materials on it, up to four times a side', () => {
		const layoutSize = (materials: number) =>
			sheetsOf(targets(0, materials), 512).map(({ size }) => size)
		expect(layoutSize(2)).toEqual([1024])
		expect(layoutSize(4)).toEqual([1024])
		expect(layoutSize(5)).toEqual([2048])
		expect(layoutSize(40)).toEqual([2048])
	})

	it('keeps every material on a layout on its one map', () => {
		const [sheet] = sheetsOf(targets(0, 3), 512)
		expect(sheet.materials).toHaveLength(3)
	})

	it('halves a layout’s map with the material’s map when a bake recovers at lower detail', () => {
		expect(layoutMapSize(256, 1)).toBe(256)
		expect(layoutMapSize(256, 16)).toBe(1024)
	})
})
