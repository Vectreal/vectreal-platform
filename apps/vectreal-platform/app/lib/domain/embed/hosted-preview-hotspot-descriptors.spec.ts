/**
 * What the handshake is allowed to tell a host page about a scene's hotspots.
 *
 * The filter is the load-bearing part. `redactSettingsForEmbed`, which strips
 * `internalOnly` hotspots, runs in exactly one place - `buildEmbedSceneManifest`
 * - and `/preview` never reaches it, because it always takes the session
 * branch. So on that route the settings this hook is handed are unredacted, and
 * `resolveHotspotMarkers`' default options are the only thing standing between
 * an internal marker's name and whichever origin pinged the frame.
 */
import { describe, expect, it } from 'vitest'

import { buildHotspotDescriptors } from './hosted-preview-bridge'

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

describe('buildHotspotDescriptors', () => {
	it('describes a published hotspot by what a host can navigate with', () => {
		expect(
			buildHotspotDescriptors([
				hotspot({
					id: 'a',
					name: 'Handle',
					linkedCameraId: 'cam-1',
					sequenceIndex: 0
				})
			])
		).toEqual([{ id: 'a', name: 'Handle', cameraId: 'cam-1', step: 1 }])
	})

	it('reports no camera as null rather than omitting it', () => {
		// A marker that only reveals content flies nothing, and a host has to be
		// able to tell that apart from a field it failed to read.
		expect(buildHotspotDescriptors([hotspot({ id: 'a' })])[0]).toMatchObject({
			cameraId: null,
			step: null
		})
	})

	it('never names a hotspot the author kept backstage', () => {
		const descriptors = buildHotspotDescriptors([
			hotspot({ id: 'public', name: 'Handle' }),
			hotspot({
				id: 'internal',
				name: 'Supplier part number',
				internalOnly: true
			})
		])

		expect(descriptors.map((entry) => entry.id)).toEqual(['public'])
	})

	it('never names a hotspot the author hid', () => {
		const descriptors = buildHotspotDescriptors([
			hotspot({ id: 'public' }),
			hotspot({ id: 'hidden', visible: false })
		])

		expect(descriptors.map((entry) => entry.id)).toEqual(['public'])
	})

	it('numbers the steps a visitor sees, not the ones the author stored', () => {
		// An internal marker sitting in the sequence takes no number, so the
		// steps either side of it read the same for a host as they do on screen.
		const descriptors = buildHotspotDescriptors([
			hotspot({ id: 'first', sequenceIndex: 0 }),
			hotspot({ id: 'backstage', sequenceIndex: 1, internalOnly: true }),
			hotspot({ id: 'second', sequenceIndex: 2 })
		])

		expect(descriptors.map((entry) => entry.step)).toEqual([1, 2])
	})

	it('says nothing at all about a scene with no hotspots', () => {
		expect(buildHotspotDescriptors(undefined)).toEqual([])
		expect(buildHotspotDescriptors([])).toEqual([])
	})

	it('carries no body and no link', () => {
		// The content is what the viewer draws. A second copy on the host page
		// would have nothing keeping it in step - and on `/preview` it would be
		// a second copy of unredacted text.
		const [descriptor] = buildHotspotDescriptors([
			hotspot({
				id: 'a',
				body: 'Cast in one piece.',
				linkUrl: 'https://a.test'
			})
		])

		expect(Object.keys(descriptor).sort()).toEqual([
			'cameraId',
			'id',
			'name',
			'step'
		])
	})
})
