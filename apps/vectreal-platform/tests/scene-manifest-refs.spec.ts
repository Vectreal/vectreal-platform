import { vi } from 'vitest'

// Mock the settings service to avoid DB initialization at import time.
// sceneSettingsService is a module-level singleton that calls getDbClient()
// in its constructor; this prevents that chain from running in unit tests.
vi.mock('../app/lib/domain/scene/server/scene-settings-service.server', () => ({
	sceneSettingsService: {}
}))

import { toAssetRefs } from '../app/lib/domain/scene/server/scene-aggregate.server'

const asset = (overrides: Record<string, unknown>) => ({
	id: 'a1',
	name: 'texture.webp',
	mimeType: 'image/webp',
	fileSize: 1234,
	...overrides
})

describe('toAssetRefs', () => {
	const buildUrl = (id: string) => `/api/scenes/s1/assets/${id}`

	it('maps asset records to refs with built URLs', () => {
		const refs = toAssetRefs([asset({ id: 'a1' })] as never, buildUrl)
		expect(refs).toEqual({
			a1: {
				url: '/api/scenes/s1/assets/a1',
				fileName: 'texture.webp',
				mimeType: 'image/webp',
				byteSize: 1234
			}
		})
	})

	it('excludes the scene thumbnail and the glTF JSON asset', () => {
		const refs = toAssetRefs(
			[
				asset({ id: 'a1', name: 'scene-thumbnail.webp' }),
				asset({ id: 'a2', mimeType: 'model/gltf+json', name: 'scene.gltf' }),
				asset({ id: 'a3', name: 'model.bin', mimeType: null, fileSize: null })
			] as never,
			buildUrl
		)
		expect(Object.keys(refs)).toEqual(['a3'])
		expect(refs.a3.mimeType).toBe('application/octet-stream')
		expect(refs.a3.byteSize).toBeNull()
	})
})
