import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { resolveSceneSizeBytes } from './scene-stored-size'

describe('resolveSceneSizeBytes', () => {
	const assets = [{ fileSize: 300 }, { fileSize: 200 }, { fileSize: null }]

	it('is the published GLB once the scene is published', () => {
		expect(
			resolveSceneSizeBytes(
				{ currentSceneBytes: 120, initialSceneBytes: 9000 },
				assets
			)
		).toBe(120)
	})

	// A saved scene that was never published: what it stores, not the upload.
	it('is what the scene stores before it is published', () => {
		expect(
			resolveSceneSizeBytes(
				{ currentSceneBytes: null, initialSceneBytes: 9000 },
				assets
			)
		).toBe(500)
	})

	it('is the original upload only when nothing else is known', () => {
		expect(resolveSceneSizeBytes({ initialSceneBytes: 9000 }, [])).toBe(9000)
		expect(resolveSceneSizeBytes(null, [])).toBeNull()
	})
})

// A source guard: the route cannot be imported by a test (its module scope
// opens the database), and this is the one line that shows the rule.
describe('the scene detail page', () => {
	it('sizes the scene by that rule', () => {
		const route = readFileSync(
			join(
				import.meta.dirname,
				'../../../routes/dashboard-page/projects/scene.tsx'
			),
			'utf8'
		)
		expect(route).toContain('resolveSceneSizeBytes(stats, sceneAssets)')
	})
})
