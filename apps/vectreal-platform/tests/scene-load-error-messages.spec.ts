import { describe, expect, it } from 'vitest'

import { getDashboardSceneLoadErrorMessage } from '../app/lib/domain/scene/scene-load-error-messages'

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

	it('falls back to structured error message for other codes', () => {
		const message = getDashboardSceneLoadErrorMessage({
			code: 'gltf_load_failed',
			message: 'Custom failure',
			source: 'local-upload'
		})

		expect(message).toBe('Custom failure')
	})

	it('falls back to default for unknown values', () => {
		expect(getDashboardSceneLoadErrorMessage(null)).toBe('Failed to load scene.')
	})
})
