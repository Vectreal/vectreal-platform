import { describe, expect, it } from 'vitest'

import {
	getDashboardSceneLoadErrorMessage,
	getUploadLoadErrorMessage,
	listFileNames,
	missingTexturesNotice,
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

describe('an upload refusal names the files it is about', () => {
	const refusal = (
		code: StructuredLoadError['code'],
		context: Record<string, unknown>
	): StructuredLoadError => ({
		code,
		message: '',
		recoverable: true,
		source: 'local-upload',
		context
	})

	it('names the textures a glTF did not get', () => {
		expect(
			getUploadLoadErrorMessage(
				refusal('missing_assets', {
					fileName: 'chair.gltf',
					missingFiles: ['textures/wood.png']
				})
			)
		).toBe(
			'chair.gltf needs textures/wood.png, which did not come with it. Drop the whole folder it lives in, or export it as one GLB.'
		)
	})

	it('names the models and the one to drop', () => {
		expect(
			getUploadLoadErrorMessage(
				refusal('multiple_models', { fileNames: ['chair.gltf', 'chair.fbx'] })
			)
		).toBe(
			'This selection holds chair.gltf and chair.fbx, and the publisher opens one model at a time. Drop chair.gltf on its own, with its files.'
		)
	})

	it('keeps the general sentences when no names came with the error', () => {
		expect(getUploadLoadErrorMessage(refusal('missing_assets', {}))).toMatch(
			/^Model references missing assets/
		)
		// Opened by URL: names the files, but there is no folder to drop.
		expect(
			getUploadLoadErrorMessage(
				refusal('missing_assets', { missingFiles: ['wood.png'] })
			)
		).toMatch(/^Model references missing assets/)
		expect(getUploadLoadErrorMessage(refusal('multiple_models', {}))).toBe(
			'Multiple models found. Upload one model at a time.'
		)
	})
})

describe('listFileNames', () => {
	it.each([
		[['a.png'], 'a.png'],
		[['a.png', 'b.png'], 'a.png and b.png'],
		[['a.png', 'b.png', 'c.png'], 'a.png, b.png and c.png'],
		[['a', 'b', 'c', 'd', 'e'], 'a, b, c and 2 more']
	])('lists %j as %s', (names, sentence) => {
		expect(listFileNames(names)).toBe(sentence)
	})
})

describe('missingTexturesNotice', () => {
	const file = (missingTextures?: string[]) => ({
		name: 'scene.gltf',
		missingTextures
	})

	it('names the images a dropped glTF opened without, and the folder to bring', () => {
		expect(
			missingTexturesNotice(file(['textures/wood.png', 'textures/metal.png']), {
				fromDisk: true
			})
		).toBe(
			'scene.gltf opened without textures/wood.png and textures/metal.png, which did not come with it, so those surfaces show their plain color. To see them textured, drop the whole folder it lives in.'
		)
	})

	it('sends a model opened from a URL to no folder', () => {
		expect(missingTexturesNotice(file(['wood.png']), { fromDisk: false })).toBe(
			'scene.gltf opened without wood.png, which did not come with it, so those surfaces show their plain color.'
		)
	})

	it('says nothing when nothing was missing', () => {
		expect(missingTexturesNotice(file(), { fromDisk: true })).toBeNull()
		expect(missingTexturesNotice(file([]), { fromDisk: true })).toBeNull()
	})
})
