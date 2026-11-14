import { describe, expect, it } from 'vitest'

import { getDashboardSceneLoadErrorMessage } from './scene-load-error-messages'

describe('getDashboardSceneLoadErrorMessage', () => {
	it('maps not_found to user-facing copy', () => {
		const message = getDashboardSceneLoadErrorMessage({
			code: 'not_found',
			message: 'raw message',
			source: 'server-load'
		})

		expect(message).toBe(
			'Scene not found. It may have been removed or your access may have changed.'
		)
	})

	it('maps server_load_failed to network guidance', () => {
		const message = getDashboardSceneLoadErrorMessage({
			code: 'server_load_failed',
			message: 'raw message',
			source: 'server-load'
		})

		expect(message).toBe(
			'Scene loading failed due to a server or network issue. Retry in a moment.'
		)
	})

	it.each([
		[
			'a structured error with an unmapped code',
			{
				code: 'gltf_load_failed',
				message: 'raw failure',
				source: 'local-upload'
			}
		],
		['a thrown Error', new Error('raw failure')],
		['a bare string', 'raw failure']
	])('never shows the raw text of %s', (_, error) => {
		expect(getDashboardSceneLoadErrorMessage(error)).toBe(
			'Failed to load scene.'
		)
	})

	it('falls back to default for unknown values', () => {
		expect(getDashboardSceneLoadErrorMessage(null)).toBe(
			'Failed to load scene.'
		)
	})
})
