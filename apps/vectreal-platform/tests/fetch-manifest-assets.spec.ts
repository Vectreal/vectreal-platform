import { fetchManifestAssetData } from '@vctrl/hooks/use-load-model'

const refs = {
	a1: { url: '/assets/a1', fileName: 'model.bin', mimeType: 'application/octet-stream', byteSize: 2 },
	a2: { url: '/assets/a2', fileName: 'tex.webp', mimeType: 'image/webp', byteSize: 2 }
}

describe('fetchManifestAssetData', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('fetches all refs in parallel into Uint8Array entries', async () => {
		vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
			ok: true,
			arrayBuffer: async () =>
				new Uint8Array(url.endsWith('a1') ? [1, 2] : [3, 4]).buffer
		})))

		const result = await fetchManifestAssetData(refs)

		expect(Array.from(result.a1.data as Uint8Array)).toEqual([1, 2])
		expect(result.a1.fileName).toBe('model.bin')
		expect(result.a2.mimeType).toBe('image/webp')
	})

	it('reports byte-weighted progress', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => ({
			ok: true,
			arrayBuffer: async () => new Uint8Array([0, 0]).buffer
		})))
		const fractions: number[] = []

		await fetchManifestAssetData(refs, { onProgress: (f) => fractions.push(f) })

		expect(fractions[fractions.length - 1]).toBe(1)
	})

	it('throws when any asset fetch fails', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))

		await expect(fetchManifestAssetData(refs)).rejects.toThrow('404')
	})
})
