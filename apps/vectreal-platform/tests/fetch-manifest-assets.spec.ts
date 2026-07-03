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

	it('uses count-weighted progress when some refs lack byteSize', async () => {
		const mixedRefs = {
			sized: { url: '/assets/sized', fileName: 'model.bin', mimeType: 'application/octet-stream', byteSize: 100 },
			unsized: { url: '/assets/unsized', fileName: 'tex.webp', mimeType: 'image/webp', byteSize: null }
		}

		const fractions: number[] = []
		let resolveUnsized: (value?: any) => void = () => {}

		vi.stubGlobal('fetch', vi.fn((url: string) => {
			if (url.includes('sized')) {
				return Promise.resolve({
					ok: true,
					arrayBuffer: async () => new Uint8Array([1, 2]).buffer
				})
			} else {
				return Promise.resolve({
					ok: true,
					arrayBuffer: () => new Promise<ArrayBuffer>(resolve => {
						resolveUnsized = () => resolve(new Uint8Array([3, 4]).buffer)
					})
				})
			}
		}))

		const fetchPromise = fetchManifestAssetData(mixedRefs, { onProgress: (f) => fractions.push(f) })

		// Allow microtask queue to process (sized fetch should complete first)
		await new Promise(resolve => setTimeout(resolve, 0))

		// At this point, sized fetch should have completed and reported 0.5
		// (both fetch calls start in parallel, but sized completes first)
		expect(fractions.length).toBeGreaterThan(0)
		expect(fractions.some(f => f < 1)).toBe(true)

		// Resolve the unsized fetch
		resolveUnsized()
		await fetchPromise

		// Final progress should be 1
		expect(fractions[fractions.length - 1]).toBe(1)
	})
})
