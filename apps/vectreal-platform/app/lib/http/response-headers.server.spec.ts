import {
	manifestResponse,
	noStoreHeaders,
	withNoStore
} from './response-headers.server'

const request = (ifNoneMatch?: string) =>
	new Request('https://vectreal.test/api/scenes/s1', {
		headers: ifNoneMatch ? { 'If-None-Match': ifNoneMatch } : {}
	})

describe('withNoStore', () => {
	it('keeps the status, body and headers, and forbids caching', async () => {
		const response = withNoStore(
			new Response('{"ok":true}', {
				status: 404,
				headers: { 'Content-Type': 'application/json', 'X-Extra': '1' }
			})
		)

		expect(response.status).toBe(404)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		expect(response.headers.get('X-Extra')).toBe('1')
		expect(await response.text()).toBe('{"ok":true}')
	})
})

describe('noStoreHeaders', () => {
	it('adds no-store to whatever it is given', () => {
		const headers = noStoreHeaders({ Allow: 'GET' })

		expect(headers.get('Cache-Control')).toBe('no-store')
		expect(headers.get('Allow')).toBe('GET')
	})
})

describe('manifestResponse', () => {
	const manifest = { sceneId: 's1' }

	it('sends the manifest with its ETag and a revalidate-first cache policy', async () => {
		const response = manifestResponse(request(), manifest, '"v1"', {
			'Set-Cookie': 'session=1'
		})

		expect(response.status).toBe(200)
		expect(response.headers.get('ETag')).toBe('"v1"')
		expect(response.headers.get('Cache-Control')).toBe('private, no-cache')
		expect(response.headers.get('Set-Cookie')).toBe('session=1')
		expect(await response.json()).toEqual({ success: true, data: manifest })
	})

	it('answers a matching If-None-Match with an empty 304 that keeps the auth headers', async () => {
		const response = manifestResponse(request('"v1"'), manifest, '"v1"', {
			'Set-Cookie': 'session=1'
		})

		expect(response.status).toBe(304)
		expect(response.headers.get('ETag')).toBe('"v1"')
		expect(response.headers.get('Set-Cookie')).toBe('session=1')
		expect(await response.text()).toBe('')
	})

	it('sends the body when the client holds a stale ETag', () => {
		expect(manifestResponse(request('"v0"'), manifest, '"v1"').status).toBe(200)
	})

	it('never answers 304 and sets no ETag when there is none to compare', () => {
		const response = manifestResponse(request('"v1"'), manifest, null)

		expect(response.status).toBe(200)
		expect(response.headers.has('ETag')).toBe(false)
	})
})
