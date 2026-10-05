import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	getThreeKtx2Loader,
	prepareThreeKtx2Transcoder
} from './ktx2-three-loader'

const transcoderPath = 'https://vectreal.test/basis/'

function serveTranscoder(responses: Array<'ok' | 'down'>) {
	const fetch = vi.fn(async (request: Request) => {
		if (responses.shift() === 'down') {
			return new Response('unavailable', { status: 503 })
		}
		return request.url.endsWith('.wasm')
			? new Response(new ArrayBuffer(8))
			: new Response('/* transcoder */')
	})
	vi.stubGlobal('fetch', fetch)
	// three's FileLoader reports progress with a browser-only event.
	vi.stubGlobal('ProgressEvent', class extends Event {})
	return fetch
}

describe('the shared KTX2 loader', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('reports a failed transcoder download to the caller', async () => {
		serveTranscoder(['down', 'down'])
		await expect(
			prepareThreeKtx2Transcoder(`${transcoderPath}down/`)
		).rejects.toThrow(/503/)
	})

	it('disposes a failed loader and recovers on the next call', async () => {
		const path = `${transcoderPath}recovers/`
		const fetch = serveTranscoder(['down', 'down', 'ok', 'ok'])

		const failed = await getThreeKtx2Loader(path)
		const dispose = vi.spyOn(failed, 'dispose')
		await expect(prepareThreeKtx2Transcoder(path)).rejects.toThrow()
		expect(dispose).toHaveBeenCalledOnce()

		await expect(prepareThreeKtx2Transcoder(path)).resolves.toBeUndefined()
		expect(await getThreeKtx2Loader(path)).not.toBe(failed)
		expect(fetch).toHaveBeenCalledTimes(4)
	})

	it('keeps one loader once its transcoder is ready', async () => {
		const path = `${transcoderPath}ready/`
		const fetch = serveTranscoder(['ok', 'ok'])

		await prepareThreeKtx2Transcoder(path)
		const ready = await getThreeKtx2Loader(path)
		await prepareThreeKtx2Transcoder(path)

		expect(await getThreeKtx2Loader(path)).toBe(ready)
		expect(fetch).toHaveBeenCalledTimes(2)
	})

	it('transcodes to RGBA where no GPU format can be detected', async () => {
		serveTranscoder([])
		const loader = await getThreeKtx2Loader(`${transcoderPath}detect/`)
		expect(Object.values(loader.workerConfig).some(Boolean)).toBe(false)
	})

	it('disposes the loader for a path it moves away from', async () => {
		serveTranscoder([])
		const previous = await getThreeKtx2Loader(`${transcoderPath}first/`)
		const dispose = vi.spyOn(previous, 'dispose')

		await getThreeKtx2Loader(`${transcoderPath}second/`)

		expect(dispose).toHaveBeenCalledOnce()
	})
})
