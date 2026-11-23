/**
 * The hero's file is baked for its lighting, and the stage draws a light map
 * only while the lighting it lights with is the one the map was baked from.
 * Re-light the hero without re-baking, and the maps silently stay off.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { drawnLightsSignature, LIGHTMAP_EXTENSION } from '@vctrl/core'
import { describe, expect, it } from 'vitest'

import { HERO_MODEL } from '../../../lib/samples/sample-models'
import { HERO_RESOLVED_LIGHTING } from './hero-lighting'

interface MaterialJson {
	name: string
	occlusionTexture?: unknown
	extensions?: Record<string, { signature?: string }>
}

const materials = (): MaterialJson[] => {
	const glb = readFileSync(
		join(__dirname, '../../../assets/models', HERO_MODEL.fileName)
	)
	const length = glb.readUInt32LE(12)
	return JSON.parse(glb.subarray(20, 20 + length).toString('utf8')).materials
}

describe("the hero's studio finish", () => {
	it('bakes the studio lights the hero is lit by into every material', () => {
		const signature = drawnLightsSignature(HERO_RESOLVED_LIGHTING)
		expect(signature).not.toBe('')
		for (const material of materials()) {
			expect(
				material.extensions?.[LIGHTMAP_EXTENSION]?.signature,
				material.name
			).toBe(signature)
		}
	})

	it('bakes depth into every material', () => {
		for (const material of materials()) {
			expect(material.occlusionTexture, material.name).toBeDefined()
		}
	})
})
