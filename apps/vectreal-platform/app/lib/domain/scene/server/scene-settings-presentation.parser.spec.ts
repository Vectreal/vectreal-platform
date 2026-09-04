import { SceneSettingsParser } from './scene-settings.parser.server'

import type { SceneSettingsRequest } from '../../../../types/api'

/**
 * The author's info-popover choice, driven through the public request parser
 * rather than through `normalizePresentationSettings` directly.
 *
 * `scene-presentation.spec.ts` already pins the rule. What is unguarded
 * without this is the wiring: `parseSettingsData` writes every unrecognized
 * settings field to its column verbatim, so the normalizer only protects the
 * column while it is actually called from there.
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
	// Asserted, not optional-chained: `settings` is optional on the request, so
	// reading through `?.` would let a parser that stopped returning settings
	// at all satisfy every `toBeUndefined` below without ever normalizing.
	if (!settings) throw new Error('the parser returned no settings')
	return settings
}

describe('presentation settings on the save path', () => {
	it('carries an author’s explicit choice through, either way', () => {
		expect(
			parsed(parse({ presentation: { showInfoPopover: false } }))
		).toMatchObject({
			presentation: { showInfoPopover: false }
		})
		expect(
			parsed(parse({ presentation: { showInfoPopover: true } }))
		).toMatchObject({
			presentation: { showInfoPopover: true }
		})
	})

	it('refuses to store a non-boolean as the author’s choice', () => {
		// Without the normalizer on this path the string would be stored as-is
		// and later read as truthy, turning an author's off into an on.
		expect(
			parsed(parse({ presentation: { showInfoPopover: 'false' } }))
				?.presentation
		).toBeUndefined()
	})

	it('leaves a scene that says nothing about presentation alone', () => {
		expect(parsed(parse({})).presentation).toBeUndefined()
	})
})
