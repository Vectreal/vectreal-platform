import { describe, expect, it } from 'vitest'

import { resolveSceneBackdrop, sceneBackdropCss } from '.'

describe('resolveSceneBackdrop', () => {
	it('is null for a scene that names no backdrop, as every older scene does', () => {
		expect(resolveSceneBackdrop()).toBeNull()
		expect(resolveSceneBackdrop({ background: false })).toBeNull()
	})

	it('gives way to the environment map while it is the background', () => {
		expect(
			resolveSceneBackdrop({
				background: true,
				backdrop: { type: 'color', color: '#f4f4f5' }
			})
		).toBeNull()
	})

	it('returns a hex color or gradient as stored', () => {
		const color = { type: 'color', color: '#F4f4F5' } as const
		const gradient = {
			type: 'gradient',
			top: '#ffffff',
			bottom: '#d4d4d8'
		} as const
		expect(resolveSceneBackdrop({ backdrop: color })).toBe(color)
		expect(resolveSceneBackdrop({ backdrop: gradient })).toBe(gradient)
	})

	it.each([
		'url(https://example.com/pixel.png)',
		'red',
		'#fff',
		'#ffffff; color: red',
		''
	])('refuses %j, which is not #rrggbb', (value) => {
		expect(
			resolveSceneBackdrop({ backdrop: { type: 'color', color: value } })
		).toBeNull()
		expect(
			resolveSceneBackdrop({
				backdrop: { type: 'gradient', top: '#ffffff', bottom: value }
			})
		).toBeNull()
		expect(
			resolveSceneBackdrop({
				backdrop: { type: 'gradient', top: value, bottom: '#ffffff' }
			})
		).toBeNull()
	})
})

describe('sceneBackdropCss', () => {
	it('paints a color flat and a gradient top to bottom', () => {
		expect(sceneBackdropCss({ type: 'color', color: '#f4f4f5' })).toBe(
			'#f4f4f5'
		)
		expect(
			sceneBackdropCss({ type: 'gradient', top: '#ffffff', bottom: '#d4d4d8' })
		).toBe('linear-gradient(to bottom, #ffffff, #d4d4d8)')
	})
})
