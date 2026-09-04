import { SceneSettingsParser } from './scene-settings.parser.server'

/**
 * Hotspot validation lives behind the public request parser, so these drive it
 * from there. Everything except `hotspots` is held constant.
 */

const HOTSPOT_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ID = '22222222-2222-4222-8222-222222222222'

const hotspot = (overrides: Record<string, unknown> = {}) => ({
	id: HOTSPOT_ID,
	name: 'Handle',
	worldPosition: [1, 2, 3],
	visible: true,
	internalOnly: false,
	stylePreset: 'dot',
	...overrides
})

const parse = (
	hotspots: unknown[],
	cameras: Record<string, unknown>[] = [{ cameraId: 'cam-1', kind: 'scene' }]
) =>
	SceneSettingsParser.parseSceneSettingsRequestData({
		action: 'update',
		sceneId: '33333333-3333-4333-8333-333333333333',
		settings: { camera: { cameras }, hotspots }
	})

/** The parser answers a rejection with a Response, and a pass with the request. */
const rejected = (result: unknown): result is Response =>
	result instanceof Response

const bodyOf = async (result: unknown) => {
	if (!rejected(result)) throw new Error('expected a rejection')
	return (await result.clone().json()) as { error?: string; message?: string }
}

describe('hotspot validation', () => {
	it('accepts a well-formed hotspot', () => {
		expect(rejected(parse([hotspot()]))).toBe(false)
	})

	// The publisher offers three style presets and the core type declares
	// three. This set used to hold two, so choosing SVG rejected the save.
	it.each(['dot', 'image', 'svg'])('accepts the %s style preset', (preset) => {
		expect(rejected(parse([hotspot({ stylePreset: preset })]))).toBe(false)
	})

	it('rejects a style preset outside the three', () => {
		expect(rejected(parse([hotspot({ stylePreset: 'lottie' })]))).toBe(true)
	})

	it('accepts occlusionEnabled in either position and when absent', () => {
		expect(rejected(parse([hotspot({ occlusionEnabled: true })]))).toBe(false)
		expect(rejected(parse([hotspot({ occlusionEnabled: false })]))).toBe(false)
		expect(rejected(parse([hotspot()]))).toBe(false)
	})

	it('rejects a non-boolean occlusionEnabled', () => {
		expect(rejected(parse([hotspot({ occlusionEnabled: 'yes' })]))).toBe(true)
	})

	// The id lands in a uuid primary key. Catching it here is what turns a
	// stale client into a 400 instead of a failed transaction.
	it('rejects the legacy non-uuid id format', async () => {
		const result = parse([hotspot({ id: 'hotspot-1755000000000-a1b2c3' })])
		expect(rejected(result)).toBe(true)
		expect(JSON.stringify(await bodyOf(result))).toContain('UUID')
	})

	it('rejects two hotspots sharing an id, which would violate the primary key', () => {
		expect(rejected(parse([hotspot(), hotspot()]))).toBe(true)
	})

	it('rejects a linkedCameraId that names no camera', () => {
		expect(rejected(parse([hotspot({ linkedCameraId: 'gone' })]))).toBe(true)
	})

	it('accepts a linkedCameraId that names a real camera', () => {
		expect(rejected(parse([hotspot({ linkedCameraId: 'cam-1' })]))).toBe(false)
	})

	it('rejects duplicate sequence indices', () => {
		expect(
			rejected(
				parse([
					hotspot({ sequenceIndex: 0 }),
					hotspot({ id: OTHER_ID, sequenceIndex: 0 })
				])
			)
		).toBe(true)
	})

	it('accepts distinct sequence indices, including gaps', () => {
		expect(
			rejected(
				parse([
					hotspot({ sequenceIndex: 0 }),
					hotspot({ id: OTHER_ID, sequenceIndex: 2 })
				])
			)
		).toBe(false)
	})

	it('rejects a negative or fractional sequence index', () => {
		expect(rejected(parse([hotspot({ sequenceIndex: -1 })]))).toBe(true)
		expect(rejected(parse([hotspot({ sequenceIndex: 1.5 })]))).toBe(true)
	})

	it('rejects a malformed world position', () => {
		expect(rejected(parse([hotspot({ worldPosition: [1, 2] })]))).toBe(true)
		expect(rejected(parse([hotspot({ worldPosition: [1, 2, 'z'] })]))).toBe(
			true
		)
	})

	it('rejects a missing name', () => {
		expect(rejected(parse([hotspot({ name: '  ' })]))).toBe(true)
	})
})

describe('hotspot ceilings and payload URLs', () => {
	/** Distinct, valid uuids so the count is the only thing under test. */
	const manyHotspots = (count: number) =>
		Array.from({ length: count }, (_, i) =>
			hotspot({
				id: `${(i + 1).toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`
			})
		)

	it('accepts a scene at the ceiling', () => {
		expect(rejected(parse(manyHotspots(200)))).toBe(false)
	})

	it('rejects a scene past the ceiling', async () => {
		const result = parse(manyHotspots(201))
		expect(rejected(result)).toBe(true)
		expect((await bodyOf(result)).error).toMatch(/at most 200/)
	})

	it('rejects a script URL in payloadUrl', async () => {
		const result = parse([
			hotspot({ stylePreset: 'image', payloadUrl: 'javascript:alert(1)' })
		])

		expect(rejected(result)).toBe(true)
		expect((await bodyOf(result)).error).toMatch(/payloadUrl/)
	})

	it('rejects a non-string payloadUrl', async () => {
		const result = parse([hotspot({ stylePreset: 'image', payloadUrl: 42 })])

		expect(rejected(result)).toBe(true)
		expect((await bodyOf(result)).error).toMatch(/payloadUrl must be a string/)
	})

	it('accepts an https payloadUrl', () => {
		const result = parse([
			hotspot({ stylePreset: 'image', payloadUrl: 'https://cdn.test/p.png' })
		])

		expect(rejected(result)).toBe(false)
	})

	it('accepts an inline svg written without a parameter', () => {
		// RFC 2397's comma form, and the canonical inline SVG. Rejecting it would
		// 400 the whole scene save for the preset that exists to carry it.
		const result = parse([
			hotspot({
				stylePreset: 'svg',
				payloadUrl: 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E'
			})
		])

		expect(rejected(result)).toBe(false)
	})

	it('accepts an explicit null payloadUrl', () => {
		// The repository writes `payloadUrl ?? null` and the comparison module
		// types it `string | null`, so an explicit null round-trips through the
		// client. Treating it as a non-string would 400 an ordinary save.
		expect(rejected(parse([hotspot({ payloadUrl: null })]))).toBe(false)
	})

	it('leaves a legacy payloadUrl alone while the marker is a dot', () => {
		// A scene saved before this rule can hold an http:// value. The dot preset
		// never renders it and the panel never shows the field, so rejecting it
		// would make that scene permanently unsaveable with nothing to correct.
		const result = parse([
			hotspot({ stylePreset: 'dot', payloadUrl: 'http://legacy.test/p.png' })
		])

		expect(rejected(result)).toBe(false)
	})

	it('still bounds the size of a dot marker\u2019s payloadUrl', () => {
		// The column is unbounded text and every manifest reads it back whatever
		// the preset says, so the size cap cannot be preset-gated.
		const result = parse([
			hotspot({ stylePreset: 'dot', payloadUrl: 'a'.repeat(9000) })
		])

		expect(rejected(result)).toBe(true)
	})

	it('still rejects a non-string payloadUrl on a dot marker', () => {
		expect(rejected(parse([hotspot({ stylePreset: 'dot', payloadUrl: 42 })]))).toBe(
			true
		)
	})

	it('rejects that same legacy value once the marker shows an image', () => {
		const result = parse([
			hotspot({ stylePreset: 'image', payloadUrl: 'http://legacy.test/p.png' })
		])

		expect(rejected(result)).toBe(true)
	})
})
