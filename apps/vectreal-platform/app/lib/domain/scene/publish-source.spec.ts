/**
 * The description of what a publish is made from changes exactly when the
 * published GLB would: the model document and the encoding publish applies,
 * and nothing that lives outside the file.
 */
import { PERSISTED_BAKE_FILENAME, SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'
import { describe, expect, it } from 'vitest'

import { hotspotArtworkFileName } from './hotspot-artwork'
import { describePublishSource } from './publish-source'
import {
	balancedPreset,
	originalPreset
} from '../../../constants/optimizations'

const model = [
	{ id: 'gltf', name: 'scene.gltf', mimeType: 'model/gltf+json' },
	{ id: 'bin', name: 'scene.bin', mimeType: 'application/octet-stream' },
	{ id: 'tex', name: 'textures/diffuse.png', mimeType: 'image/png' }
]
const HOTSPOT_ID = '11111111-1111-4111-8111-111111111111'
const base = {
	assets: model,
	optimizationSettings: balancedPreset,
	presentation: {},
	lighting: undefined
}

describe('describePublishSource', () => {
	it('is the same for the same saved scene', () => {
		expect(describePublishSource(base)).toBe(
			describePublishSource({ ...base, assets: [...model].reverse() })
		)
	})

	it('changes when a texture is replaced under the same name', () => {
		expect(
			describePublishSource({
				...base,
				assets: [
					...model.slice(0, 2),
					{ id: 'tex-2', name: 'textures/diffuse.png', mimeType: 'image/png' }
				]
			})
		).not.toBe(describePublishSource(base))
	})

	it('ignores the thumbnail, marker artwork and shadow bake, which live outside the GLB', () => {
		// Swapping a marker's image must not read as a scene that needs
		// republishing: the GLB is byte-identical.
		expect(
			describePublishSource({
				...base,
				assets: [
					...model,
					{
						id: 'thumb',
						name: SCENE_THUMBNAIL_FILENAME,
						mimeType: 'image/webp'
					},
					{ id: 'bake', name: PERSISTED_BAKE_FILENAME, mimeType: 'image/png' },
					{
						id: 'art',
						name: hotspotArtworkFileName(HOTSPOT_ID, 'image/png'),
						mimeType: 'image/png'
					}
				]
			})
		).toBe(describePublishSource(base))
	})

	it('changes when Draco is switched or retuned', () => {
		const described = describePublishSource(base)
		const { draco } = balancedPreset

		expect(
			describePublishSource({
				...base,
				optimizationSettings: {
					...balancedPreset,
					draco: { ...draco, enabled: !draco.enabled }
				}
			})
		).not.toBe(described)
		expect(
			describePublishSource({
				...base,
				optimizationSettings: {
					...balancedPreset,
					draco: { ...draco, method: 'sequential' }
				}
			})
		).not.toBe(
			describePublishSource({
				...base,
				optimizationSettings: {
					...balancedPreset,
					draco: { ...draco, method: 'edgebreaker' }
				}
			})
		)
	})

	it('ignores key order and the legacy `name` field', () => {
		expect(
			describePublishSource({
				...base,
				optimizationSettings: {
					...balancedPreset,
					draco: {
						method: 'edgebreaker',
						name: 'draco',
						enabled: true
					} as never
				}
			})
		).toBe(describePublishSource(base))
	})

	it('changes with the GPU texture switch, a presentation setting that changes the file', () => {
		expect(
			describePublishSource({
				...base,
				presentation: { compressTexturesForGpu: false }
			})
		).not.toBe(describePublishSource(base))
	})

	it('reads a switch set to its default as the default', () => {
		expect(
			describePublishSource({
				...base,
				presentation: { compressTexturesForGpu: true }
			})
		).toBe(describePublishSource(base))
	})

	it('ignores every other presentation setting, which embeds read live', () => {
		expect(
			describePublishSource({
				...base,
				presentation: { showInfoPopover: true }
			})
		).toBe(describePublishSource(base))
	})

	it('reads a scene saved without settings as the original upload', () => {
		expect(describePublishSource({ ...base, optimizationSettings: null })).toBe(
			describePublishSource({ ...base, optimizationSettings: originalPreset })
		)
	})

	it('changes with what the lighting bakes in, and not with live lighting', () => {
		const key = { role: 'key' as const, azimuth: 30 }
		const baked = { lights: [key], bake: { lights: true } }

		expect(describePublishSource({ ...base, lighting: baked })).not.toBe(
			describePublishSource(base)
		)
		expect(
			describePublishSource({
				...base,
				lighting: { ...baked, lights: [{ ...key, azimuth: 31 }] }
			})
		).not.toBe(describePublishSource({ ...base, lighting: baked }))
		// Live lights are drawn by the embed, so the file is the same.
		expect(
			describePublishSource({ ...base, lighting: { lights: [key] } })
		).toBe(describePublishSource(base))
	})

	it('describes a scene that bakes nothing as it did before bakes existed', () => {
		expect(JSON.parse(describePublishSource(base))).not.toHaveProperty('bakes')
	})
})
