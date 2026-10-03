import { describe, expect, it } from 'vitest'

import {
	IMG_TO_3D_ERROR_COPY,
	IMG_TO_3D_ERROR_KINDS,
	IMG_TO_3D_FIELDS,
	IMG_TO_3D_MAX_IMAGE_BYTES,
	imgTo3dErrorKind,
	parseImgTo3dSubmission
} from './img-to-3d-contract'

function png(bytes = 16, type = 'image/png'): File {
	return new File([new Uint8Array(bytes)], 'chair.png', { type })
}

function form(
	overrides: Partial<Record<keyof typeof IMG_TO_3D_FIELDS, string | File>> = {}
): FormData {
	const values = {
		image: png(),
		resolution: '1024',
		textureSize: '2048',
		decimationTarget: '200000',
		seedCount: '3',
		...overrides
	}
	const data = new FormData()
	for (const [key, value] of Object.entries(values)) {
		data.set(IMG_TO_3D_FIELDS[key as keyof typeof IMG_TO_3D_FIELDS], value)
	}
	return data
}

describe('parseImgTo3dSubmission', () => {
	it('accepts every setting at both ends of its range', () => {
		for (const overrides of [
			{
				resolution: '512',
				textureSize: '1024',
				decimationTarget: '10000',
				seedCount: '1'
			},
			{
				resolution: '1536',
				textureSize: '4096',
				decimationTarget: '1000000',
				seedCount: '3'
			}
		]) {
			const parsed = parseImgTo3dSubmission(form(overrides))
			expect(parsed.ok).toBe(true)
		}
	})

	it('reads the settings as numbers', () => {
		const parsed = parseImgTo3dSubmission(form())
		expect(parsed).toMatchObject({
			ok: true,
			submission: {
				resolution: 1024,
				textureSize: 2048,
				decimationTarget: 200_000,
				seedCount: 3
			}
		})
	})

	it.each([
		['a resolution the runtime has no pipeline for', { resolution: '768' }],
		['a texture size off the list', { textureSize: '3000' }],
		['a triangle target just under the floor', { decimationTarget: '9999' }],
		[
			'a triangle target just over the ceiling',
			{ decimationTarget: '1000001' }
		],
		['no variants', { seedCount: '0' }],
		['more variants than allowed', { seedCount: '4' }],
		['a negative number', { decimationTarget: '-10000' }],
		['scientific notation', { decimationTarget: '1e5' }],
		['a fraction', { seedCount: '1.5' }]
	])('refuses %s', (_, overrides) => {
		expect(parseImgTo3dSubmission(form(overrides))).toEqual({
			ok: false,
			error: 'invalid_settings'
		})
	})

	it('refuses a missing or empty image', () => {
		const missing = form()
		missing.delete(IMG_TO_3D_FIELDS.image)
		expect(parseImgTo3dSubmission(missing)).toEqual({
			ok: false,
			error: 'image_missing'
		})
		expect(parseImgTo3dSubmission(form({ image: png(0) }))).toEqual({
			ok: false,
			error: 'image_missing'
		})
	})

	it('refuses an image type the runtime cannot read', () => {
		expect(
			parseImgTo3dSubmission(form({ image: png(16, 'image/gif') }))
		).toEqual({ ok: false, error: 'image_type' })
	})

	it('accepts an image at the size limit and refuses one byte over', () => {
		expect(
			parseImgTo3dSubmission(form({ image: png(IMG_TO_3D_MAX_IMAGE_BYTES) })).ok
		).toBe(true)
		expect(
			parseImgTo3dSubmission(
				form({ image: png(IMG_TO_3D_MAX_IMAGE_BYTES + 1) })
			)
		).toEqual({ ok: false, error: 'image_too_large' })
	})
})

describe('imgTo3dErrorKind', () => {
	it('passes a known kind through', () => {
		for (const kind of IMG_TO_3D_ERROR_KINDS) {
			expect(imgTo3dErrorKind(kind)).toBe(kind)
		}
	})

	it('reads anything else as unexpected, so no other text reaches the panel', () => {
		for (const value of [
			'Not found',
			'Invalid CSRF token',
			'CUDA out of memory',
			undefined,
			null,
			42
		]) {
			expect(imgTo3dErrorKind(value)).toBe('unexpected')
		}
	})

	it('has copy for every kind', () => {
		for (const kind of IMG_TO_3D_ERROR_KINDS) {
			expect(IMG_TO_3D_ERROR_COPY[kind].trim()).not.toBe('')
		}
	})
})
