import {
	ASSET_CACHE_CONTROL,
	assetResponse,
	sanitizeMimeType
} from './asset-response.server'

describe('sanitizeMimeType', () => {
	it.each([
		'image/png',
		'image/gif',
		'image/svg+xml',
		'image/ktx2',
		'model/gltf-binary'
	])('passes %s through', (type) => {
		expect(sanitizeMimeType(type)).toBe(type)
	})

	it.each(['text/html', 'application/xml', '', null, undefined])(
		'downgrades %s to an opaque download',
		(type) => {
			expect(sanitizeMimeType(type)).toBe('application/octet-stream')
		}
	)
})

describe('assetResponse', () => {
	const bytes = new Uint8Array([1, 2, 3])

	it('serves the bytes as a sandboxed, unsniffable, immutable file', async () => {
		const response = assetResponse(bytes, 'image/png', { 'Last-Modified': 'x' })

		expect(response.status).toBe(200)
		expect(response.headers.get('Content-Type')).toBe('image/png')
		expect(response.headers.get('Cache-Control')).toBe(ASSET_CACHE_CONTROL)
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
		expect(response.headers.get('Content-Security-Policy')).toBe('sandbox')
		expect(response.headers.get('Last-Modified')).toBe('x')
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
	})

	/*
	  SVG goes out as itself so a marker can draw it, which is only safe because
	  this policy rides along: opened directly, its scripts stay inert.
	*/
	it('sandboxes an SVG it serves as itself', () => {
		const headers = assetResponse(bytes, 'image/svg+xml').headers

		expect(headers.get('Content-Type')).toBe('image/svg+xml')
		expect(headers.get('Content-Security-Policy')).toBe('sandbox')
		expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
	})

	it('never lets an active type reach the wire', () => {
		expect(assetResponse(bytes, 'text/html').headers.get('Content-Type')).toBe(
			'application/octet-stream'
		)
	})

	it('takes a caller cache policy over the immutable default', () => {
		expect(
			assetResponse(
				bytes,
				'image/png',
				undefined,
				'public, max-age=60'
			).headers.get('Cache-Control')
		).toBe('public, max-age=60')
	})
})
