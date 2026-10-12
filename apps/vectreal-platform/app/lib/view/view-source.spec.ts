import { describe, expect, it } from 'vitest'

import {
	isGlb,
	modelFileName,
	parseViewSource,
	siblingReferences,
	urlFilePath
} from './view-source'

const PAGE = 'https://vectreal.com'

describe('parseViewSource', () => {
	it('opens nothing without a src', () => {
		expect(parseViewSource(null, PAGE)).toEqual({ kind: 'none' })
		expect(parseViewSource('   ', PAGE)).toEqual({ kind: 'none' })
	})

	it('accepts an https link', () => {
		const source = parseViewSource(' https://example.com/a.glb ', PAGE)

		expect(source.kind).toBe('url')
		expect(source.kind === 'url' && source.url.href).toBe(
			'https://example.com/a.glb'
		)
	})

	it('accepts http only on a loopback host', () => {
		expect(parseViewSource('http://localhost:8000/a.glb', PAGE).kind).toBe(
			'url'
		)
		expect(parseViewSource('http://127.0.0.1/a.glb', PAGE).kind).toBe('url')
		expect(parseViewSource('http://example.com/a.glb', PAGE).kind).toBe(
			'invalid'
		)
	})

	it.each([
		'javascript:alert(1)',
		'data:model/gltf-binary;base64,Z2xURg==',
		'blob:https://example.com/0f6b',
		'file:///Users/a/model.glb',
		'ftp://example.com/a.glb'
	])('refuses %s', (raw) => {
		expect(parseViewSource(raw, PAGE).kind).toBe('invalid')
	})

	it('refuses something that is not a URL', () => {
		const source = parseViewSource('example.com/a.glb', PAGE)

		expect(source).toMatchObject({ kind: 'invalid', raw: 'example.com/a.glb' })
	})

	it('refuses a link to this site', () => {
		expect(parseViewSource('https://vectreal.com/api/x', PAGE).kind).toBe(
			'invalid'
		)
		// The same host to DNS and to the browser.
		expect(parseViewSource('https://vectreal.com./api/x', PAGE).kind).toBe(
			'invalid'
		)
	})
})

describe('modelFileName', () => {
	it('reads the format off the last path segment', () => {
		expect(modelFileName(new URL('https://a.com/m/Chair.GLB?v=2'))).toBe(
			'Chair.GLB'
		)
		expect(modelFileName(new URL('https://a.com/my%20chair.stl'))).toBe(
			'my chair.stl'
		)
	})

	it('says nothing for a link without a readable format', () => {
		expect(modelFileName(new URL('https://a.com/download?id=7'))).toBeNull()
		expect(modelFileName(new URL('https://a.com/m.usdz'))).toBeNull()
	})
})

describe('isGlb', () => {
	it('recognises the binary glTF magic', () => {
		expect(isGlb(new TextEncoder().encode('glTF\u0002\u0000'))).toBe(true)
		expect(isGlb(new TextEncoder().encode('{"asset"'))).toBe(false)
		expect(isGlb(new Uint8Array())).toBe(false)
	})
})

describe('siblingReferences', () => {
	const model = new URL('https://cdn.example.com/models/chair/chair.gltf')

	it('resolves relative references against the model link', () => {
		const siblings = siblingReferences(
			{
				buffers: [{ uri: 'chair.bin' }],
				images: [{ uri: '../textures/wood%20grain.png' }]
			},
			model
		)

		expect(siblings.map(({ url }) => url.href).sort()).toEqual([
			'https://cdn.example.com/models/chair/chair.bin',
			'https://cdn.example.com/models/textures/wood%20grain.png'
		])
		expect(siblings.map(({ path }) => path).sort()).toEqual([
			'models/chair/chair.bin',
			'models/textures/wood grain.png'
		])
	})

	it('follows nothing on another host, ours included', () => {
		const siblings = siblingReferences(
			{
				images: [
					{ uri: 'https://tracker.example.net/pixel.png' },
					{ uri: 'https://vectreal.com/api/auth/signout' },
					{ uri: '//other.example.org/a.png' }
				]
			},
			model
		)

		expect(siblings).toEqual([])
	})

	it('skips inline data and repeats', () => {
		const siblings = siblingReferences(
			{
				buffers: [{ uri: 'data:application/octet-stream;base64,AA==' }],
				images: [{ uri: 'a.png' }, { uri: './a.png' }]
			},
			model
		)

		expect(siblings.map(({ path }) => path)).toEqual(['models/chair/a.png'])
	})
})

describe('urlFilePath', () => {
	it('drops the leading slash and decodes', () => {
		expect(urlFilePath(new URL('https://a.com/x/y%20z.glb'))).toBe('x/y z.glb')
	})
})
