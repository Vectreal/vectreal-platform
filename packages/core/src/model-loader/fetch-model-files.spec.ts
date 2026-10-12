import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchModelFiles, ModelFetchError } from './fetch-model-files'

const GLB_BYTES = new TextEncoder().encode('glTF\u0002\u0000\u0000\u0000rest')

function stubFetch(
	routes: Record<string, () => Response | Promise<Response>>
): ReturnType<typeof vi.fn> {
	const fetchMock = vi.fn(async (input: URL | string) => {
		const route = routes[String(input)]
		if (!route) throw new TypeError('Failed to fetch')
		return route()
	})
	vi.stubGlobal('fetch', fetchMock)
	return fetchMock
}

afterEach(() => {
	vi.unstubAllGlobals()
})

async function rejection(promise: Promise<unknown>): Promise<ModelFetchError> {
	const error = await promise.then(
		() => null,
		(reason: unknown) => reason
	)
	expect(error).toBeInstanceOf(ModelFetchError)
	return error as ModelFetchError
}

describe('fetchModelFiles', () => {
	it('reads a model link into a named file', async () => {
		stubFetch({ 'https://a.com/m/chair.glb': () => new Response(GLB_BYTES) })

		const [file] = await fetchModelFiles(new URL('https://a.com/m/chair.glb'))

		expect(file.name).toBe('chair.glb')
		expect(new Uint8Array(await file.arrayBuffer())).toEqual(GLB_BYTES)
	})

	it("sends the caller's request settings with every request", async () => {
		const fetchMock = stubFetch({
			'https://a.com/chair.gltf': () =>
				new Response(JSON.stringify({ buffers: [{ uri: 'chair.bin' }] })),
			'https://a.com/chair.bin': () => new Response('bin')
		})
		const init: RequestInit = {
			credentials: 'omit',
			headers: { Authorization: 'Bearer t' }
		}

		await fetchModelFiles('https://a.com/chair.gltf', { init })

		expect(fetchMock).toHaveBeenCalledTimes(2)
		for (const [, sent] of fetchMock.mock.calls) expect(sent).toBe(init)
	})

	it('reads a relative URL against the page it runs on', async () => {
		vi.stubGlobal('location', { href: 'https://a.com/app/page' })
		stubFetch({
			'https://a.com/app/m/chair.glb': () => new Response(GLB_BYTES)
		})

		const [file] = await fetchModelFiles('m/chair.glb')

		expect(file.name).toBe('chair.glb')
	})

	it('names a GLB the link does not name', async () => {
		stubFetch({ 'https://a.com/download?id=7': () => new Response(GLB_BYTES) })

		const [file] = await fetchModelFiles(new URL('https://a.com/download?id=7'))

		expect(file.name).toBe('model.glb')
	})

	it('refuses bytes nothing identifies', async () => {
		stubFetch({ 'https://a.com/download': () => new Response('<html>') })

		const error = await rejection(
			fetchModelFiles(new URL('https://a.com/download'))
		)
		expect(error.kind).toBe('unrecognized')
	})

	it('reports a refused or failed request as unreachable', async () => {
		stubFetch({})

		const error = await rejection(
			fetchModelFiles(new URL('https://no-cors.example/a.glb'))
		)
		expect(error.kind).toBe('unreachable')
	})

	it('reports a status the host answered with', async () => {
		stubFetch({
			'https://a.com/gone.glb': () => new Response('missing', { status: 404 })
		})

		const error = await rejection(
			fetchModelFiles(new URL('https://a.com/gone.glb'))
		)
		expect(error).toMatchObject({ kind: 'http', status: 404 })
		// The host, never the address: a signed link is a credential.
		expect(error.host).toBe('a.com')
		expect(JSON.stringify({ ...error, message: error.message })).not.toContain(
			'gone.glb'
		)
	})

	it('brings a glTF its same-origin files, placed as a dropped folder', async () => {
		const gltf = JSON.stringify({
			buffers: [{ uri: 'chair.bin' }],
			images: [
				{ uri: '../tex/wood.png' },
				{ uri: 'https://elsewhere.example/x.png' }
			]
		})
		const fetchMock = stubFetch({
			'https://a.com/m/chair/chair.gltf': () => new Response(gltf),
			'https://a.com/m/chair/chair.bin': () => new Response('bin'),
			'https://a.com/m/tex/wood.png': () => new Response('png')
		})

		const files = await fetchModelFiles(
			new URL('https://a.com/m/chair/chair.gltf')
		)

		expect(files[0].webkitRelativePath).toBe('m/chair/chair.gltf')
		expect(
			files.slice(1).map((file) => [file.name, file.webkitRelativePath])
		).toEqual(
			expect.arrayContaining([
				['chair.bin', 'm/chair/chair.bin'],
				['wood.png', 'm/tex/wood.png']
			])
		)
		expect(files).toHaveLength(3)
		expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContain(
			'https://elsewhere.example/x.png'
		)
	})

	it('leaves redirects to the browser, for the model and its files', async () => {
		const fetchMock = stubFetch({
			'https://a.com/chair.gltf': () =>
				new Response(JSON.stringify({ buffers: [{ uri: 'chair.bin' }] })),
			'https://a.com/chair.bin': () => new Response('bin')
		})

		await fetchModelFiles(new URL('https://a.com/chair.gltf'))

		for (const [, sent] of fetchMock.mock.calls) {
			expect(sent?.redirect).toBeUndefined()
		}
	})

	it('passes an abort through rather than calling it unreachable', async () => {
		const controller = new AbortController()
		controller.abort()
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new DOMException('aborted', 'AbortError')
			})
		)

		const error = await fetchModelFiles('https://a.com/m.glb', {
			init: { signal: controller.signal }
		}).catch((reason: unknown) => reason)

		expect(error).not.toBeInstanceOf(ModelFetchError)
		expect(error).toMatchObject({ name: 'AbortError' })
	})

	it('rejects with the abort when it lands while the files download', async () => {
		const controller = new AbortController()
		stubFetch({
			'https://a.com/chair.gltf': () =>
				new Response(JSON.stringify({ buffers: [{ uri: 'chair.bin' }] })),
			'https://a.com/chair.bin': () => {
				controller.abort()
				throw new DOMException('aborted', 'AbortError')
			}
		})

		const error = await fetchModelFiles('https://a.com/chair.gltf', {
			init: { signal: controller.signal }
		}).catch((reason: unknown) => reason)

		expect(error).toMatchObject({ name: 'AbortError' })
	})

	it('rejects with an abort that lands after the bytes arrived', async () => {
		const controller = new AbortController()
		stubFetch({
			'https://a.com/download?id=7': () => {
				// The response is in hand; the abort comes during what follows.
				controller.abort()
				return new Response(GLB_BYTES)
			}
		})

		const error = await fetchModelFiles('https://a.com/download?id=7', {
			init: { signal: controller.signal }
		}).catch((reason: unknown) => reason)

		expect(error).toMatchObject({ name: 'AbortError' })
	})

	it('reports an abort, not the failure that followed it', async () => {
		const controller = new AbortController()
		const reason = new Error('the visitor left')
		stubFetch({
			'https://a.com/download?id=7': () => {
				controller.abort(reason)
				return new Response('<html>')
			}
		})

		const error = await fetchModelFiles('https://a.com/download?id=7', {
			init: { signal: controller.signal }
		}).catch((caught: unknown) => caught)

		// The caller's own reason, not a stand-in for it.
		expect(error).toBe(reason)
	})

	it('rejects a signal aborted before it began, whatever the address', async () => {
		const error = await fetchModelFiles('http://[', {
			init: { signal: AbortSignal.abort() }
		}).catch((reason: unknown) => reason)

		expect(error).toMatchObject({ name: 'AbortError' })
	})

	it('refuses an address that is not a URL, as a fetch error', async () => {
		const error = await rejection(fetchModelFiles('http://['))
		expect(error.kind).toBe('invalid')
		expect(error.message).not.toContain('[')
	})

	it('leaves out a sibling that cannot be read, for the loader to name', async () => {
		stubFetch({
			'https://a.com/chair.gltf': () =>
				new Response(JSON.stringify({ buffers: [{ uri: 'chair.bin' }] }))
		})

		const files = await fetchModelFiles(new URL('https://a.com/chair.gltf'))

		expect(files.map((file) => file.name)).toEqual(['chair.gltf'])
	})

	it('does not read an empty success as a status to explain', async () => {
		stubFetch({
			'https://a.com/m.glb': () => new Response(null, { status: 204 })
		})

		const error = await rejection(
			fetchModelFiles(new URL('https://a.com/m.glb'))
		)
		expect(error.kind).toBe('unrecognized')
	})

	it('reports progress against the declared length', async () => {
		stubFetch({
			'https://a.com/chair.glb': () =>
				new Response(GLB_BYTES, {
					headers: { 'Content-Length': String(GLB_BYTES.byteLength) }
				})
		})
		const progress: number[] = []

		await fetchModelFiles(new URL('https://a.com/chair.glb'), {
			onProgress: (fraction) => progress.push(fraction)
		})

		expect(progress.at(-1)).toBe(1)
	})
})
