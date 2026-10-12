import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchRemoteModel, RemoteModelError } from './fetch-remote-model'

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

async function rejection(promise: Promise<unknown>): Promise<RemoteModelError> {
	const error = await promise.then(
		() => null,
		(reason: unknown) => reason
	)
	expect(error).toBeInstanceOf(RemoteModelError)
	return error as RemoteModelError
}

describe('fetchRemoteModel', () => {
	it('reads a model link into a named file', async () => {
		stubFetch({ 'https://a.com/m/chair.glb': () => new Response(GLB_BYTES) })

		const [file] = await fetchRemoteModel(new URL('https://a.com/m/chair.glb'))

		expect(file.name).toBe('chair.glb')
		expect(new Uint8Array(await file.arrayBuffer())).toEqual(GLB_BYTES)
	})

	it('sends no cookies and no referrer', async () => {
		const fetchMock = stubFetch({
			'https://a.com/chair.glb': () => new Response(GLB_BYTES)
		})

		await fetchRemoteModel(new URL('https://a.com/chair.glb'))

		expect(fetchMock).toHaveBeenCalledWith(
			new URL('https://a.com/chair.glb'),
			expect.objectContaining({
				credentials: 'omit',
				referrerPolicy: 'no-referrer'
			})
		)
	})

	it('names a GLB the link does not name', async () => {
		stubFetch({ 'https://a.com/download?id=7': () => new Response(GLB_BYTES) })

		const [file] = await fetchRemoteModel(
			new URL('https://a.com/download?id=7')
		)

		expect(file.name).toBe('model.glb')
	})

	it('refuses bytes nothing identifies', async () => {
		stubFetch({ 'https://a.com/download': () => new Response('<html>') })

		const error = await rejection(
			fetchRemoteModel(new URL('https://a.com/download'))
		)
		expect(error.kind).toBe('unrecognized')
	})

	it('reports a refused or failed request as unreachable', async () => {
		stubFetch({})

		const error = await rejection(
			fetchRemoteModel(new URL('https://no-cors.example/a.glb'))
		)
		expect(error.kind).toBe('unreachable')
	})

	it('reports a status the host answered with', async () => {
		stubFetch({
			'https://a.com/gone.glb': () => new Response('missing', { status: 404 })
		})

		const error = await rejection(
			fetchRemoteModel(new URL('https://a.com/gone.glb'))
		)
		expect(error).toMatchObject({ kind: 'http', status: 404 })
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

		const files = await fetchRemoteModel(
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
		expect(fetchMock).not.toHaveBeenCalledWith(
			new URL('https://elsewhere.example/x.png'),
			expect.anything()
		)
	})

	it('follows a redirect for the model, never for its files', async () => {
		const fetchMock = stubFetch({
			'https://a.com/chair.gltf': () =>
				new Response(JSON.stringify({ buffers: [{ uri: 'chair.bin' }] })),
			'https://a.com/chair.bin': () => new Response('bin')
		})

		await fetchRemoteModel(new URL('https://a.com/chair.gltf'))

		const redirectFor = (url: string) =>
			fetchMock.mock.calls.find(([input]) => String(input) === url)?.[1]
				?.redirect
		expect(redirectFor('https://a.com/chair.gltf')).toBeUndefined()
		expect(redirectFor('https://a.com/chair.bin')).toBe('error')
	})

	it('leaves out a sibling that cannot be read, for the loader to name', async () => {
		stubFetch({
			'https://a.com/chair.gltf': () =>
				new Response(JSON.stringify({ buffers: [{ uri: 'chair.bin' }] }))
		})

		const files = await fetchRemoteModel(new URL('https://a.com/chair.gltf'))

		expect(files.map((file) => file.name)).toEqual(['chair.gltf'])
	})

	it('does not read an empty success as a status to explain', async () => {
		stubFetch({
			'https://a.com/m.glb': () => new Response(null, { status: 204 })
		})

		const error = await rejection(
			fetchRemoteModel(new URL('https://a.com/m.glb'))
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

		await fetchRemoteModel(new URL('https://a.com/chair.glb'), {
			onProgress: (fraction) => progress.push(fraction)
		})

		expect(progress.at(-1)).toBe(1)
	})
})
