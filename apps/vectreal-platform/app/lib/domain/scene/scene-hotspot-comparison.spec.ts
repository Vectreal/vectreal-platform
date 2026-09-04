import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { haveHotspotsChanged } from './scene-hotspot-comparison'

const hotspot = (overrides: Record<string, unknown> = {}) => ({
	id: '11111111-1111-4111-8111-111111111111',
	name: 'Handle',
	worldPosition: [1, 2, 3],
	visible: true,
	internalOnly: false,
	stylePreset: 'dot',
	occlusionEnabled: true,
	...overrides
})

describe('haveHotspotsChanged', () => {
	it('treats an unchanged list as unchanged', () => {
		expect(haveHotspotsChanged([hotspot()], [hotspot()])).toBe(false)
	})

	it('treats both sides empty as unchanged, however emptiness is spelled', () => {
		expect(haveHotspotsChanged([], [])).toBe(false)
		expect(haveHotspotsChanged(undefined, [])).toBe(false)
		expect(haveHotspotsChanged([], undefined)).toBe(false)
	})

	// The defect this module exists for: each of these is a hotspot-only edit,
	// which the save path used to answer with success and then discard.
	it('detects a rename', () => {
		expect(haveHotspotsChanged([hotspot({ name: 'Lid' })], [hotspot()])).toBe(
			true
		)
	})

	it('detects a move', () => {
		expect(
			haveHotspotsChanged([hotspot({ worldPosition: [1, 2, 4] })], [hotspot()])
		).toBe(true)
	})

	it('detects a visibility toggle', () => {
		expect(
			haveHotspotsChanged([hotspot({ visible: false })], [hotspot()])
		).toBe(true)
	})

	it('detects an editor-only toggle', () => {
		expect(
			haveHotspotsChanged([hotspot({ internalOnly: true })], [hotspot()])
		).toBe(true)
	})

	it('detects a sequence reorder', () => {
		expect(
			haveHotspotsChanged(
				[hotspot({ sequenceIndex: 2 })],
				[hotspot({ sequenceIndex: 1 })]
			)
		).toBe(true)
	})

	it('detects a depth-occlusion toggle', () => {
		expect(
			haveHotspotsChanged([hotspot({ occlusionEnabled: false })], [hotspot()])
		).toBe(true)
	})

	it('detects a style preset change', () => {
		expect(
			haveHotspotsChanged([hotspot({ stylePreset: 'svg' })], [hotspot()])
		).toBe(true)
	})

	it('detects a camera link change', () => {
		expect(
			haveHotspotsChanged([hotspot({ linkedCameraId: 'cam-1' })], [hotspot()])
		).toBe(true)
	})

	it('detects an addition and a removal', () => {
		const second = hotspot({ id: '22222222-2222-4222-8222-222222222222' })
		expect(haveHotspotsChanged([hotspot(), second], [hotspot()])).toBe(true)
		expect(haveHotspotsChanged([hotspot()], [hotspot(), second])).toBe(true)
	})

	it('detects a replacement that keeps the count the same', () => {
		expect(
			haveHotspotsChanged(
				[hotspot({ id: '22222222-2222-4222-8222-222222222222' })],
				[hotspot()]
			)
		).toBe(true)
	})

	it('ignores array order, since only sequenceIndex carries ordering', () => {
		const a = hotspot({ sequenceIndex: 0 })
		const b = hotspot({
			id: '22222222-2222-4222-8222-222222222222',
			sequenceIndex: 1
		})
		expect(haveHotspotsChanged([a, b], [b, a])).toBe(false)
	})

	it('reads an absent occlusionEnabled as enabled, matching the column default', () => {
		expect(
			haveHotspotsChanged(
				[hotspot({ occlusionEnabled: undefined })],
				[hotspot()]
			)
		).toBe(false)
	})

	it('treats absent and null optionals as the same', () => {
		expect(
			haveHotspotsChanged(
				[hotspot({ linkedCameraId: undefined, payloadUrl: undefined })],
				[hotspot({ linkedCameraId: null, payloadUrl: null })]
			)
		).toBe(false)
	})

	// Positions round-trip through single-precision `real` columns. Without a
	// tolerance every scene holding a hotspot would report as changed forever.
	it('absorbs single-precision drift from the round trip', () => {
		expect(
			haveHotspotsChanged(
				[hotspot({ worldPosition: [0.1, 0.2, 0.3] })],
				[
					hotspot({
						worldPosition: [
							0.10000000149011612, 0.20000000298023224, 0.30000001192092896
						]
					})
				]
			)
		).toBe(false)
	})

	it('still catches a move smaller than a millimetre at unit scale', () => {
		expect(
			haveHotspotsChanged(
				[hotspot({ worldPosition: [1, 2, 3] })],
				[hotspot({ worldPosition: [1.0005, 2, 3] })]
			)
		).toBe(true)
	})
})

describe('hotspot content', () => {
	// Save availability is driven by this comparison, so a field the comparator
	// does not read is a field an author can edit with the button staying
	// disabled - the edit looks refused rather than unsaved.
	it('detects body text being added, changed and cleared', () => {
		expect(
			haveHotspotsChanged(
				[hotspot({ body: 'Cast in one piece.' })],
				[hotspot()]
			)
		).toBe(true)
		expect(
			haveHotspotsChanged(
				[hotspot({ body: 'Machined.' })],
				[hotspot({ body: 'Cast.' })]
			)
		).toBe(true)
		expect(haveHotspotsChanged([hotspot()], [hotspot({ body: 'Cast.' })])).toBe(
			true
		)
	})

	it('detects a link being added, changed and cleared', () => {
		expect(
			haveHotspotsChanged([hotspot({ linkUrl: 'https://a.test' })], [hotspot()])
		).toBe(true)
		expect(
			haveHotspotsChanged(
				[hotspot({ linkUrl: 'https://b.test' })],
				[hotspot({ linkUrl: 'https://a.test' })]
			)
		).toBe(true)
		expect(
			haveHotspotsChanged([hotspot()], [hotspot({ linkUrl: 'https://a.test' })])
		).toBe(true)
	})

	it('reads absent and null as the same unset value on both fields', () => {
		// The client omits a cleared field; a row read back carries null. If
		// these differed, every scene with a text-free hotspot would report
		// itself dirty on load and offer a save that changes nothing.
		expect(
			haveHotspotsChanged(
				[hotspot({ body: undefined, linkUrl: undefined })],
				[hotspot({ body: null, linkUrl: null })]
			)
		).toBe(false)
	})
})

/**
 * `sameHotspot` enumerates every field by hand, and this is the third
 * hand-maintained enumeration of the hotspot shape after the draft payload and
 * `toSceneSettings`. Both of the others dropped a field silently before anyone
 * noticed, so rather than patch this one a third time and hope, the guard reads
 * `HotspotDefinition` out of the core type and requires every field to appear
 * in the comparison.
 *
 * A name match, not a semantic one: it cannot tell a correct comparison from a
 * wrong one, only a present field from a missing one. That is the failure it is
 * for - the next field added to the type and forgotten here.
 */
describe('sameHotspot covers HotspotDefinition', () => {
	const coreTypes = readFileSync(
		join(
			import.meta.dirname,
			'../../../../../../packages/core/src/types/scene-types.ts'
		),
		'utf8'
	)
	const comparison = readFileSync(
		join(import.meta.dirname, 'scene-hotspot-comparison.ts'),
		'utf8'
	)

	const interfaceBody = coreTypes
		.split('export interface HotspotDefinition {')[1]
		?.split('\n}')[0]

	const fields = [...(interfaceBody ?? '').matchAll(/^\t(\w+)\??:/gm)].map(
		(match) => match[1]
	)

	const sameHotspotBody = comparison
		.split('const sameHotspot =')[1]
		?.split('export const haveHotspotsChanged')[0]

	it('found the type and the comparison to read', () => {
		// Without this the two splits above could yield nothing and every
		// assertion below would pass over an empty list.
		expect(fields.length).toBeGreaterThan(5)
		expect(sameHotspotBody).toBeTruthy()
	})

	it.each(
		// `id` identifies which stored hotspot to compare against and is matched
		// by `haveHotspotsChanged`; comparing it inside `sameHotspot` could only
		// ever be true.
		fields.filter((field) => field !== 'id')
	)('compares %s', (field) => {
		expect(sameHotspotBody).toContain(`a.${field}`)
		expect(sameHotspotBody).toContain(`b.${field}`)
	})
})
