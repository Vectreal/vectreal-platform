import { describe, expect, it } from 'vitest'

import { SceneSettingsParser } from './scene-settings.parser.server'

import type { SceneSettingsRequest } from '../../../../types/api'

/**
 * Animation settings driven through the public request parser rather than
 * through `normalizeSceneAnimation`, which core already tests.
 *
 * What only this can catch is the wiring: `parseSettingsData` writes every
 * settings field it does not recognize to its column verbatim, so without the
 * normalizer call a stringly-typed `"true"` or a clip with no id would be
 * stored and served to every embed of the scene.
 */

const parse = (settings: Record<string, unknown>) =>
	SceneSettingsParser.parseSceneSettingsRequestData({
		action: 'update',
		sceneId: '33333333-3333-4333-8333-333333333333',
		settings
	})

const parsed = (result: unknown) => {
	if (result instanceof Response) throw new Error('expected a parsed request')
	const { settings } = result as SceneSettingsRequest
	if (!settings) throw new Error('the parser returned no settings')
	return settings
}

const clip = {
	clipId: 'Walk',
	sourceName: 'Walk',
	sourceIndex: 0,
	enabled: true,
	order: 0,
	loop: 'repeat',
	timeScale: 1.5,
	startOffset: 0
}

describe('animation settings on the save path', () => {
	it('carries a valid config through, filling what was left out', () => {
		expect(
			parsed(parse({ animation: { enabled: true, clips: [clip] } })).animation
		).toEqual({
			enabled: true,
			mode: 'simultaneous',
			autoplay: true,
			loopSequence: false,
			showControls: false,
			clips: [clip]
		})
	})

	it('reads a stored null as nothing saved', () => {
		expect(parsed(parse({ animation: null })).animation).toBeUndefined()
	})

	it('refuses a malformed config with a 400 instead of storing it', async () => {
		const result = parse({ animation: { enabled: 'true', clips: [clip] } })

		expect(result).toBeInstanceOf(Response)
		const response = result as Response
		expect(response.status).toBe(400)
		expect(await response.text()).toContain('animation.enabled')
	})

	it('refuses a clip that names no clip', () => {
		const result = parse({
			animation: { enabled: true, clips: [{ ...clip, clipId: '' }] }
		})

		expect((result as Response).status).toBe(400)
	})
})
