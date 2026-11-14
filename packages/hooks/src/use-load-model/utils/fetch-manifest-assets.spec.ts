/**
 * A saved scene's assets report bytes as they stream, summed across files.
 *
 * Mutation gate, executed: drop the `onBytes` call in `fetchManifestAssetData`
 * and both tests go red.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchManifestAssetData } from './fetch-manifest-assets'

import type { SceneAssetRefMap } from '@vctrl/core'

afterEach(() => {
	vi.unstubAllGlobals()
})

const ref = (url: string, byteSize?: number) => ({
	url,
	fileName: url.split('/').pop() ?? url,
	mimeType: 'application/octet-stream',
	byteSize
})

describe('fetchManifestAssetData', () => {
	it('sums streamed bytes across assets against the refs’ sizes', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async (url: string) =>
					new Response(new Uint8Array(url.endsWith('a.bin') ? 3 : 5))
			)
		)
		const reports: { loaded: number; total: number | null }[] = []

		const data = await fetchManifestAssetData(
			{
				a: ref('https://cdn/a.bin', 3),
				b: ref('https://cdn/b.bin', 5)
			} as unknown as SceneAssetRefMap,
			{ onBytes: (bytes) => reports.push(bytes) }
		)

		expect(reports.at(-1)).toEqual({ loaded: 8, total: 8 })
		expect(data.a.data).toHaveLength(3)
		expect(data.b.data).toHaveLength(5)
	})

	it('reports no total when any ref has no size', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(new Uint8Array(2)))
		)
		const reports: { loaded: number; total: number | null }[] = []

		await fetchManifestAssetData(
			{
				a: ref('https://cdn/a.bin', 2),
				b: ref('https://cdn/b.bin')
			} as unknown as SceneAssetRefMap,
			{ onBytes: (bytes) => reports.push(bytes) }
		)

		expect(reports.at(-1)).toEqual({ loaded: 4, total: null })
	})
})
