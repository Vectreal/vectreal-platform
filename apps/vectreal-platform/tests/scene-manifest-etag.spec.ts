import { vi } from 'vitest'

// Mock the settings service to avoid DB initialization at import time.
// sceneSettingsService is a module-level singleton that calls getDbClient()
// in its constructor; this prevents that chain from running in unit tests.
vi.mock('../app/lib/domain/scene/server/scene-settings-service.server', () => ({
	sceneSettingsService: {}
}))

import { buildSceneManifestEtag } from '../app/lib/domain/scene/server/scene-aggregate.server'

describe('buildSceneManifestEtag', () => {
	it('builds a weak etag from scene id and settings timestamp', () => {
		expect(buildSceneManifestEtag('s1', '2026-07-03T10:00:00.000Z')).toBe(
			'W/"scene-s1-2026-07-03T10:00:00.000Z"'
		)
	})

	it('returns null without a timestamp', () => {
		expect(buildSceneManifestEtag('s1', null)).toBeNull()
	})

	it('produces the same etag for the same inputs', () => {
		const ts = '2026-01-15T08:30:00.000Z'
		expect(buildSceneManifestEtag('scene-abc', ts)).toBe(
			buildSceneManifestEtag('scene-abc', ts)
		)
	})

	it('produces a different etag when the timestamp differs', () => {
		const a = buildSceneManifestEtag('s1', '2026-07-03T10:00:00.000Z')
		const b = buildSceneManifestEtag('s1', '2026-07-03T11:00:00.000Z')
		expect(a).not.toBe(b)
	})
})
