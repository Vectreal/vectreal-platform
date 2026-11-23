import { describe, expect, it } from 'vitest'

import {
	getDashboardSceneLoadErrorMessage,
	getUploadLoadErrorMessage,
	uploadLoadErrorLink
} from './scene-load-error-messages'

import type { StructuredLoadError } from '@vctrl/hooks/use-load-model'

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

describe('an upload refused for what it was', () => {
	const refused = (selection: unknown): StructuredLoadError => ({
		code: 'unsupported_format',
		message: 'No supported model found',
		recoverable: true,
		source: 'local-upload',
		context: { selection }
	})

	it('tells someone with photos there is no model, and links the offer', () => {
		const error = refused({ kind: 'photos' })

		expect(getUploadLoadErrorMessage(error)).toBe(
			'Photos are not a 3D model, so there is nothing here to open.'
		)
		expect(uploadLoadErrorLink(error)?.to).toBe('/free-model')
	})

	it('names a Blender file and how to export it', () => {
		const message = getUploadLoadErrorMessage(
			refused({ kind: 'blender', fileName: 'Chair.blend' })
		)

		expect(message).toContain('Chair.blend is a Blender file')
		expect(message).toContain('GLB')
	})

	it('names an archive and says to unzip it', () => {
		expect(
			getUploadLoadErrorMessage(
				refused({ kind: 'archive', fileName: 'chair.zip' })
			)
		).toContain('chair.zip is a zip archive')
	})

	it('keeps the format list, and no link, for anything else', () => {
		const error = refused(null)

		expect(getUploadLoadErrorMessage(error)).toMatch(
			/^Unsupported model format/
		)
		expect(uploadLoadErrorLink(error)).toBeNull()
	})
})
