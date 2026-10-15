// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { EmbedResourceHints } from '../app/components/scene-embed/embed-resource-hints'

import type { SceneEmbedManifestResponse } from '../app/types/api'

const calls = vi.hoisted(() => ({
	preload: [] as Array<[string, Record<string, unknown>]>,
	preconnect: [] as Array<[string, Record<string, unknown>]>
}))

vi.mock('react-dom', async (importOriginal) => ({
	...(await importOriginal<typeof import('react-dom')>()),
	preload: (href: string, options: Record<string, unknown>) =>
		calls.preload.push([href, options]),
	preconnect: (href: string, options: Record<string, unknown>) =>
		calls.preconnect.push([href, options])
}))

const manifest: SceneEmbedManifestResponse = {
	sceneId: 's1',
	meta: null,
	publishedModel: {
		url: '/api/scenes/s1/assets/glb-1?exp=1&sig=a',
		fileName: 'shoe.glb',
		mimeType: 'model/gltf-binary',
		byteSize: 10
	},
	assetRefs: {},
	settings: null,
	settingsUpdatedAt: null
}

describe('EmbedResourceHints', () => {
	it('preloads in the mode the loaders request in', () => {
		render(<EmbedResourceHints manifest={manifest} />)

		expect(calls.preload[0]).toEqual([
			manifest.publishedModel.url,
			{ as: 'fetch', crossOrigin: 'anonymous', fetchPriority: 'high' }
		])
		for (const [, options] of calls.preload) {
			expect(options.crossOrigin).toBe('anonymous')
		}
		expect(calls.preconnect).toEqual([
			['https://storage.googleapis.com', { crossOrigin: 'anonymous' }]
		])
	})
})
