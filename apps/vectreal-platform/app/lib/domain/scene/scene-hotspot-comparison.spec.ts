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
