import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	getThreeDracoLoader,
	prepareThreeDracoDecoder
} from './draco-three-loader'

const decoderPath = 'https://vectreal.test/draco/'

function serveDecoder(responses: Array<'ok' | 'down'>) {
	const fetch = vi.fn(async (request: Request) => {
		if (responses.shift() === 'down') {
			return new Response('unavailable', { status: 503 })
		}
		return request.url.endsWith('.wasm')
			? new Response(new ArrayBuffer(8))
			: new Response('/* decoder */')
	})
	vi.stubGlobal('fetch', fetch)
	// three's FileLoader reports progress with a browser-only event.
	vi.stubGlobal('ProgressEvent', class extends Event {})
	return fetch
}

describe('the shared Draco loader', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('reports a failed decoder download to the caller', async () => {
		serveDecoder(['down', 'down'])
		await expect(
			prepareThreeDracoDecoder(`${decoderPath}down/`)
		).rejects.toThrow(/503/)
	})

	it('recovers on the next call after a failed download', async () => {
		const path = `${decoderPath}recovers/`
		const fetch = serveDecoder(['down', 'down', 'ok', 'ok'])

		const failed = await getThreeDracoLoader(path)
		await expect(prepareThreeDracoDecoder(path)).rejects.toThrow()

		await expect(prepareThreeDracoDecoder(path)).resolves.toBeUndefined()
		expect(await getThreeDracoLoader(path)).not.toBe(failed)
		expect(fetch).toHaveBeenCalledTimes(4)
	})

	it('keeps one loader once its decoder is ready', async () => {
		const path = `${decoderPath}ready/`
		const fetch = serveDecoder(['ok', 'ok'])

		await prepareThreeDracoDecoder(path)
		const ready = await getThreeDracoLoader(path)
		await prepareThreeDracoDecoder(path)

		expect(await getThreeDracoLoader(path)).toBe(ready)
		expect(fetch).toHaveBeenCalledTimes(2)
	})
})
