/**
 * A settings read that fails is distinguishable from a scene with no
 * settings, for the callers that need to tell them apart.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../app/db/client', () => ({
	getDbClient: () => ({
		transaction: async () => {
			throw new Error('connection reset')
		}
	})
}))

vi.mock('../app/lib/observability/report-server-error.server', () => ({
	reportServerError: vi.fn()
}))

import { readEmbedSceneSettings } from '../app/lib/domain/scene/server/scene-manifest.server'
import { sceneSettingsService } from '../app/lib/domain/scene/server/scene-settings-service.server'
import { reportServerError } from '../app/lib/observability/report-server-error.server'

describe('a failed scene settings read', () => {
	it('reads as no settings, reported, by default', async () => {
		await expect(
			sceneSettingsService.getSceneSettingsWithAssetRefs('scene-1')
		).resolves.toBeNull()
		expect(reportServerError).toHaveBeenCalledOnce()
	})

	it('reaches the embed manifest as a failure', async () => {
		await expect(readEmbedSceneSettings('scene-1')).rejects.toThrow(
			'connection reset'
		)
	})
})
