import { resolveModifiedUrl } from '@vctrl/core'

describe('resolveModifiedUrl', () => {
	const map = new Map([
		['model.bin', 'blob:a'],
		['textures/wood.webp', 'blob:b'],
		['wood.webp', 'blob:b']
	])

	it('resolves exact matches', () => {
		expect(resolveModifiedUrl(map, 'model.bin')).toBe('blob:a')
	})

	it('resolves URL-encoded and ./-prefixed references', () => {
		expect(resolveModifiedUrl(map, './model.bin')).toBe('blob:a')
		expect(resolveModifiedUrl(map, 'textures%2Fwood.webp')).toBe('blob:b')
	})

	it('falls back to the basename', () => {
		expect(resolveModifiedUrl(map, 'assets/deep/wood.webp')).toBe('blob:b')
	})

	it('passes through unknown urls (data:, blob:, absolute)', () => {
		expect(resolveModifiedUrl(map, 'data:image/png;base64,xx')).toBe(
			'data:image/png;base64,xx'
		)
		expect(resolveModifiedUrl(map, 'https://cdn/x.png')).toBe('https://cdn/x.png')
	})
})
