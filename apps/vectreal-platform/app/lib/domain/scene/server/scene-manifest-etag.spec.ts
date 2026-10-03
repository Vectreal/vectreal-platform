import { describe, expect, it } from 'vitest'

import { buildSceneManifestEtag } from './scene-manifest-etag'

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

	describe('for an embed manifest', () => {
		const settingsUpdatedAt = '2026-07-03T10:00:00.000Z'
		const publication = {
			assetId: 'glb-1',
			publishedAt: new Date('2026-07-03T09:00:00.000Z')
		}

		it('never shares a tag with the session manifest', () => {
			expect(
				buildSceneManifestEtag('s1', settingsUpdatedAt, publication)
			).not.toBe(buildSceneManifestEtag('s1', settingsUpdatedAt))
		})

		it('changes on a republish that saved no settings', () => {
			const republished = {
				assetId: 'glb-2',
				publishedAt: new Date('2026-07-03T11:00:00.000Z')
			}
			expect(
				buildSceneManifestEtag('s1', settingsUpdatedAt, republished)
			).not.toBe(buildSceneManifestEtag('s1', settingsUpdatedAt, publication))
		})

		it('changes when the same GLB is published again', () => {
			const again = {
				...publication,
				publishedAt: new Date('2026-07-04T09:00:00.000Z')
			}
			expect(buildSceneManifestEtag('s1', settingsUpdatedAt, again)).not.toBe(
				buildSceneManifestEtag('s1', settingsUpdatedAt, publication)
			)
		})
	})
})
