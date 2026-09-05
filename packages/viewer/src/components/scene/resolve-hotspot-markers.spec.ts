import { describe, expect, it } from 'vitest'

import { resolveHotspotMarkers } from './resolve-hotspot-markers'

import type { HotspotDefinition } from '@vctrl/core'

const hotspot = (
	overrides: Partial<HotspotDefinition> & Pick<HotspotDefinition, 'id'>
): HotspotDefinition => ({
	name: overrides.id,
	worldPosition: [0, 0, 0],
	visible: true,
	internalOnly: false,
	stylePreset: 'dot',
	...overrides
})

/** Persisted JSON the type system says cannot exist, which it can. */
const malformed = (value: unknown) => value as HotspotDefinition

const ids = (markers: { id: string }[]) => markers.map((marker) => marker.id)

describe('resolveHotspotMarkers', () => {
	describe('what gets drawn', () => {
		it('returns nothing for absent or non-array settings', () => {
			expect(resolveHotspotMarkers(undefined)).toEqual([])
			expect(
				resolveHotspotMarkers(
					malformed({ length: 1 }) as unknown as HotspotDefinition[]
				)
			).toEqual([])
		})

		it('drops a hotspot the author hid', () => {
			const markers = resolveHotspotMarkers([
				hotspot({ id: 'shown' }),
				hotspot({ id: 'hidden', visible: false })
			])

			expect(ids(markers)).toEqual(['shown'])
		})

		it('draws a hotspot whose visible flag is missing', () => {
			const legacy = {
				...hotspot({ id: 'legacy' })
			} as Partial<HotspotDefinition>
			delete legacy.visible

			expect(ids(resolveHotspotMarkers([legacy as HotspotDefinition]))).toEqual(
				['legacy']
			)
		})

		it('hides internalOnly hotspots from a public surface', () => {
			const markers = resolveHotspotMarkers([
				hotspot({ id: 'public' }),
				hotspot({ id: 'internal', internalOnly: true })
			])

			expect(ids(markers)).toEqual(['public'])
		})

		it('draws internalOnly hotspots on an editing surface', () => {
			const markers = resolveHotspotMarkers(
				[
					hotspot({ id: 'public' }),
					hotspot({ id: 'internal', internalOnly: true })
				],
				{ includeInternal: true }
			)

			expect(ids(markers)).toEqual(['public', 'internal'])
		})

		it('still hides a hidden internalOnly hotspot on an editing surface', () => {
			const markers = resolveHotspotMarkers(
				[hotspot({ id: 'internal', internalOnly: true, visible: false })],
				{ includeInternal: true }
			)

			expect(markers).toEqual([])
		})

		it('keeps only the first hotspot claiming an id', () => {
			const markers = resolveHotspotMarkers([
				hotspot({ id: 'same', name: 'first' }),
				hotspot({ id: 'same', name: 'second' })
			])

			expect(markers.map((marker) => marker.name)).toEqual(['first'])
		})
	})

	describe('what reaches the renderer', () => {
		it('carries the stored position through, axis for axis', () => {
			const markers = resolveHotspotMarkers([
				hotspot({ id: 'a', worldPosition: [1, 2, 3] }),
				hotspot({ id: 'b', worldPosition: [-0.5, 0, 4.25] })
			])

			expect(markers.map((marker) => marker.position)).toEqual([
				[1, 2, 3],
				[-0.5, 0, 4.25]
			])
		})

		it('carries the linked camera through', () => {
			// Without it every marker degrades to a non-focusable label and
			// click-to-fly-camera is dead everywhere.
			const markers = resolveHotspotMarkers([
				hotspot({ id: 'a', linkedCameraId: 'camera-7' })
			])

			expect(markers[0].linkedCameraId).toBe('camera-7')
		})

		it('tells every marker how many steps the sequence has', () => {
			const markers = resolveHotspotMarkers([
				hotspot({ id: 'a', sequenceIndex: 0 }),
				hotspot({ id: 'b', sequenceIndex: 1 }),
				hotspot({ id: 'loose' })
			])

			expect(markers.map((marker) => marker.stepCount)).toEqual([2, 2, 2])
		})
	})

	describe('malformed persisted data', () => {
		it.each([
			['a null entry', null],
			['a string entry', 'hotspot'],
			['a missing id', { ...hotspot({ id: 'x' }), id: undefined }],
			['a non-string id', { ...hotspot({ id: 'x' }), id: 7 }],
			['a blank id', { ...hotspot({ id: 'x' }), id: '   ' }],
			[
				'a missing position',
				{ ...hotspot({ id: 'x' }), worldPosition: undefined }
			],
			[
				'a two-axis position',
				{ ...hotspot({ id: 'x' }), worldPosition: [1, 2] }
			],
			[
				'a non-numeric axis',
				{ ...hotspot({ id: 'x' }), worldPosition: [1, '2', 3] }
			],
			[
				'a NaN axis',
				{ ...hotspot({ id: 'x' }), worldPosition: [1, Number.NaN, 3] }
			],
			[
				'an infinite axis',
				{
					...hotspot({ id: 'x' }),
					worldPosition: [1, Number.POSITIVE_INFINITY, 3]
				}
			],
			[
				'an array-like position',
				{
					...hotspot({ id: 'x' }),
					worldPosition: { 0: 1, 1: 2, 2: 3, length: 3 }
				}
			]
		])('drops an entry with %s', (_label, entry) => {
			const markers = resolveHotspotMarkers([
				hotspot({ id: 'ok' }),
				malformed(entry)
			])

			expect(ids(markers)).toEqual(['ok'])
		})

		it('falls back to a default name when the stored one is unusable', () => {
			const markers = resolveHotspotMarkers([
				malformed({ ...hotspot({ id: 'blank' }), name: '   ' }),
				malformed({ ...hotspot({ id: 'wrong-type' }), name: 42 })
			])

			expect(markers.map((marker) => marker.name)).toEqual([
				'Hotspot',
				'Hotspot'
			])
		})

		it('ignores a sequence index that is not a finite number', () => {
			const markers = resolveHotspotMarkers([
				malformed({ ...hotspot({ id: 'nan' }), sequenceIndex: Number.NaN }),
				hotspot({ id: 'real', sequenceIndex: 3 })
			])

			expect(markers.map((marker) => [marker.id, marker.step])).toEqual([
				['real', 1],
				['nan', null]
			])
		})

		it('ignores a linked camera id that is not a usable string', () => {
			const markers = resolveHotspotMarkers([
				malformed({ ...hotspot({ id: 'a' }), linkedCameraId: 5 }),
				malformed({ ...hotspot({ id: 'b' }), linkedCameraId: '  ' })
			])

			expect(markers.map((marker) => marker.linkedCameraId)).toEqual([
				null,
				null
			])
		})
	})

	describe('sequence', () => {
		it('orders sequenced hotspots by sequence, then the rest as stored', () => {
			const markers = resolveHotspotMarkers([
				hotspot({ id: 'loose-a' }),
				hotspot({ id: 'second', sequenceIndex: 1 }),
				hotspot({ id: 'loose-b' }),
				hotspot({ id: 'first', sequenceIndex: 0 })
			])

			expect(ids(markers)).toEqual(['first', 'second', 'loose-a', 'loose-b'])
		})

		it('numbers steps by rank so gaps in sequenceIndex do not show', () => {
			const markers = resolveHotspotMarkers([
				hotspot({ id: 'a', sequenceIndex: 0 }),
				hotspot({ id: 'b', sequenceIndex: 4 }),
				hotspot({ id: 'c' })
			])

			expect(markers.map((marker) => marker.step)).toEqual([1, 2, null])
		})

		it('numbers the steps a visitor can actually reach, not the ones stored', () => {
			// The first stored step is hidden, so the one after it is what a visitor
			// meets first and has to be labelled step 1.
			const markers = resolveHotspotMarkers([
				hotspot({ id: 'hidden', sequenceIndex: 0, visible: false }),
				hotspot({ id: 'internal', sequenceIndex: 1, internalOnly: true }),
				hotspot({ id: 'shown', sequenceIndex: 2 })
			])

			expect(markers.map((marker) => [marker.id, marker.step])).toEqual([
				['shown', 1]
			])
		})

		it('announces the step and how many there are', () => {
			const markers = resolveHotspotMarkers([
				hotspot({ id: 'a', name: 'Handle', sequenceIndex: 0 }),
				hotspot({ id: 'b', name: 'Hinge', sequenceIndex: 1 }),
				hotspot({ id: 'c', name: 'Spout' })
			])

			expect(markers.map((marker) => marker.accessibleName)).toEqual([
				'Handle, step 1 of 2',
				'Hinge, step 2 of 2',
				'Spout'
			])
		})
	})

	describe('style presets', () => {
		it('keeps a payload preset that has artwork', () => {
			const markers = resolveHotspotMarkers([
				hotspot({ id: 'i', stylePreset: 'image', payloadUrl: 'a.png' }),
				hotspot({ id: 's', stylePreset: 'svg', payloadUrl: 'b.svg' })
			])

			expect(
				markers.map((marker) => [marker.preset, marker.payloadUrl])
			).toEqual([
				['image', 'a.png'],
				['svg', 'b.svg']
			])
		})

		it.each([
			['no payloadUrl at all', undefined],
			['a blank payloadUrl', '   '],
			['a payloadUrl that is not a string', 12]
		])('falls back to the dot preset with %s', (_label, payloadUrl) => {
			const markers = resolveHotspotMarkers([
				malformed({ ...hotspot({ id: 'x' }), stylePreset: 'image', payloadUrl })
			])

			expect(markers[0].preset).toBe('dot')
			expect(markers[0].payloadUrl).toBeNull()
		})
	})

	describe('occlusion', () => {
		it('defaults occlusion on, and honours an explicit false', () => {
			const markers = resolveHotspotMarkers([
				hotspot({ id: 'default' }),
				hotspot({ id: 'on', occlusionEnabled: true }),
				hotspot({ id: 'off', occlusionEnabled: false })
			])

			expect(markers.map((marker) => marker.occlusionEnabled)).toEqual([
				true,
				true,
				false
			])
		})
	})

	describe('an editing surface drawing more than a visitor sees', () => {
		it('draws a hotspot the author hid, and marks it as hidden', () => {
			const markers = resolveHotspotMarkers(
				[hotspot({ id: 'shown' }), hotspot({ id: 'hidden', visible: false })],
				{ includeHidden: true }
			)

			expect(ids(markers)).toEqual(['shown', 'hidden'])
			expect(markers.map((marker) => marker.hidden)).toEqual([false, true])
		})

		it('still drops a hidden hotspot when nobody asked for it', () => {
			const markers = resolveHotspotMarkers([
				hotspot({ id: 'shown' }),
				hotspot({ id: 'hidden', visible: false })
			])

			expect(ids(markers)).toEqual(['shown'])
		})

		it('gives a hidden marker no step number', () => {
			const markers = resolveHotspotMarkers(
				[
					hotspot({ id: 'a', sequenceIndex: 0 }),
					hotspot({ id: 'b', sequenceIndex: 1, visible: false }),
					hotspot({ id: 'c', sequenceIndex: 2 })
				],
				{ includeHidden: true }
			)

			expect(ids(markers)).toEqual(['a', 'b', 'c'])
			expect(markers.map((marker) => marker.step)).toEqual([1, null, 2])
		})

		it('gives an internalOnly marker no step number either', () => {
			const markers = resolveHotspotMarkers(
				[
					hotspot({ id: 'internal', sequenceIndex: 0, internalOnly: true }),
					hotspot({ id: 'public', sequenceIndex: 1 })
				],
				{ includeInternal: true }
			)

			expect(markers.map((marker) => marker.step)).toEqual([null, 1])
		})

		it('leaves every step number exactly where the visitor sees it', () => {
			// The rule this pins: an author composes against these numbers in the
			// sidebar, which ranks over the published set. If drawing extra markers
			// on the canvas renumbered them, the canvas and the sidebar would
			// disagree from the first hidden hotspot onwards.
			const stored = [
				hotspot({ id: 'a', sequenceIndex: 0 }),
				hotspot({ id: 'hidden', sequenceIndex: 1, visible: false }),
				hotspot({ id: 'internal', sequenceIndex: 2, internalOnly: true }),
				hotspot({ id: 'b', sequenceIndex: 3 })
			]

			const visitor = new Map(
				resolveHotspotMarkers(stored).map((marker) => [marker.id, marker.step])
			)
			const editor = resolveHotspotMarkers(stored, {
				includeHidden: true,
				includeInternal: true
			})

			expect(visitor).toEqual(
				new Map([
					['a', 1],
					['b', 2]
				])
			)
			for (const marker of editor) {
				expect([marker.id, marker.step]).toEqual([
					marker.id,
					visitor.get(marker.id) ?? null
				])
				expect(marker.stepCount).toBe(2)
			}
		})

		it('resolves a duplicate id the same way on every surface', () => {
			// The id is claimed before any option is consulted, so drawing extra
			// markers cannot change which of two hotspots sharing an id survives.
			// While it was claimed after the filters, the hidden one won in the
			// editor and the published one won for a visitor, and the two surfaces
			// disagreed about both the marker and its step.
			const stored = [
				hotspot({
					id: 'x',
					name: 'Hidden X',
					sequenceIndex: 0,
					visible: false
				}),
				hotspot({ id: 'x', name: 'Public X', sequenceIndex: 1 }),
				hotspot({ id: 'y', name: 'Y', sequenceIndex: 2 })
			]

			const editor = resolveHotspotMarkers(stored, {
				includeHidden: true,
				includeInternal: true
			})

			expect(editor.map((m) => [m.name, m.step])).toEqual([
				['Public X', 1],
				['Y', 2]
			])
			expect(
				resolveHotspotMarkers(stored).map((m) => [m.name, m.step])
			).toEqual(editor.map((m) => [m.name, m.step]))
		})

		it('lets a published hotspot take a duplicate id from a hidden one', () => {
			// Claiming strictly-first would drop the published hotspot entirely and
			// cost a visitor a marker they had been seeing.
			const markers = resolveHotspotMarkers([
				hotspot({ id: 'x', name: 'Hidden X', visible: false }),
				hotspot({ id: 'x', name: 'Public X' })
			])

			expect(markers.map((m) => m.name)).toEqual(['Public X'])
		})

		it('announces that a marker is hidden', () => {
			const markers = resolveHotspotMarkers(
				[hotspot({ id: 'a', name: 'Handle', visible: false })],
				{ includeHidden: true }
			)

			expect(markers[0].accessibleName).toBe('Handle, hidden')
		})
	})

	describe('content', () => {
		it('carries body text and a link through, trimmed', () => {
			const [drawn] = resolveHotspotMarkers([
				hotspot({
					id: 'a',
					body: '  Cast in one piece.  ',
					linkUrl: '  https://a.test/spec  '
				})
			])

			expect(drawn.body).toBe('Cast in one piece.')
			expect(drawn.linkUrl).toBe('https://a.test/spec')
		})

		it('reads a missing or whitespace-only field as no content at all', () => {
			const [absent] = resolveHotspotMarkers([hotspot({ id: 'a' })])
			const [blank] = resolveHotspotMarkers([
				hotspot({ id: 'b', body: '   ', linkUrl: '' })
			])

			expect(absent.body).toBeNull()
			expect(absent.linkUrl).toBeNull()
			expect(blank.body).toBeNull()
			expect(blank.linkUrl).toBeNull()
		})

		it('survives a non-string body, which would throw on trim mid-render', () => {
			// A direct consumer of this package goes through no parser at all.
			const [drawn] = resolveHotspotMarkers([
				malformed({
					id: 'a',
					name: 'Handle',
					worldPosition: [0, 0, 0],
					visible: true,
					internalOnly: false,
					stylePreset: 'dot',
					body: 42,
					linkUrl: { href: 'https://a.test' }
				})
			])

			expect(drawn.body).toBeNull()
			expect(drawn.linkUrl).toBeNull()
		})

		it('leaves the scheme to the renderer rather than filtering here', () => {
			// `resolveHotspotLink` owns that rule, and it is what decides whether
			// the marker has anything to reveal. Dropping the value here would
			// hide the field from any consumer drawing its own card.
			const [drawn] = resolveHotspotMarkers([
				hotspot({ id: 'a', linkUrl: 'javascript:alert(1)' })
			])

			expect(drawn.linkUrl).toBe('javascript:alert(1)')
		})
	})

	it('does not mutate the settings it was given', () => {
		const stored = [
			hotspot({ id: 'b', sequenceIndex: 1 }),
			hotspot({ id: 'a', sequenceIndex: 0 })
		]

		resolveHotspotMarkers(stored)

		expect(stored.map((entry) => entry.id)).toEqual(['b', 'a'])
	})
})
