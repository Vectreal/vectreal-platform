import { describe, expect, it } from 'vitest'

import { preloadEnvironmentFiles } from './scene-environment'

describe('preloadEnvironmentFiles', () => {
	it('leaves a map drei cannot preload to the scene', () => {
		const gainmap = ['map.webp', 'map-gainmap.webp', 'map.json']
		expect(() => preloadEnvironmentFiles(gainmap)).not.toThrow()
	})
})
