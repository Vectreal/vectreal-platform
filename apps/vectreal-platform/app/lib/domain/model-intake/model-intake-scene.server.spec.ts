import { SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'
import { describe, expect, it, vi } from 'vitest'

import {
	intakeSceneDeps,
	resolveIntakeScene,
	type IntakeSceneDeps
} from './model-intake-scene.server'

vi.mock('../scene/server/scene-preview-repository.server', () => ({
	getPublishedScenePreview: vi.fn()
}))
vi.mock('../scene/server/scene-manifest.server', () => ({
	readEmbedSceneSettings: vi.fn()
}))
vi.mock('../embed/inline-embed-manifest.server', () => ({
	buildInlineEmbedManifest: vi.fn()
}))

const P = '6f1c2a0e-1b7d-4c55-9a0e-0d3b9f6c1a11'
const DEFAULT = '92aae012-e003-4b65-8bd8-dfd4dcd6399d'
const LAMP = '4c5122c9-2058-4ac6-8b27-9d4b94a8be13'
const OPTIONS = 'cameraControls=0&hotspots=0&hint=0'
const request = new Request('https://vectreal.com/free-model?c=K7Q2M9AB')

function fakes(overrides: Partial<IntakeSceneDeps> = {}): IntakeSceneDeps {
	return {
		...intakeSceneDeps,
		scenes: () => ({
			ok: true,
			scenes: {
				default: { projectId: P, sceneId: DEFAULT, token: 'vctrl_a' },
				lamp: { projectId: P, sceneId: LAMP, token: 'vctrl b' }
			}
		}),
		getPublishedScenePreview: vi.fn(async () => ({}) as never),
		readEmbedSceneSettings: vi.fn(async () => ({}) as never),
		buildInlineEmbedManifest: vi.fn(async (_request, { sceneId }) => ({
			sceneId,
			meta: { name: 'Leuchte', description: '', thumbnailUrl: '' },
			publishedModel: {} as never,
			settings: null,
			settingsUpdatedAt: null,
			assetRefs: {
				thumb: {
					url: `/api/scenes/${sceneId}/assets/thumb?sig=1`,
					fileName: SCENE_THUMBNAIL_FILENAME,
					mimeType: 'image/webp',
					byteSize: 1
				}
			}
		})),
		reportServerError: vi.fn(),
		...overrides
	}
}

describe('resolveIntakeScene', () => {
	it("shows the letter's showcase, with its poster and an embed path carrying the key", async () => {
		expect(await resolveIntakeScene(request, 'lamp', fakes())).toEqual({
			embedPath: `/embed/${P}/${LAMP}?token=vctrl+b&${OPTIONS}`,
			posterUrl: `/api/scenes/${LAMP}/assets/thumb?sig=1`,
			title: 'Leuchte'
		})
	})

	it('falls back to the default scene', async () => {
		const scene = await resolveIntakeScene(request, 'coffee', fakes())
		expect(scene?.embedPath).toBe(
			`/embed/${P}/${DEFAULT}?token=vctrl_a&${OPTIONS}`
		)
	})

	it('shows no scene when none is configured or it is not published', async () => {
		expect(
			await resolveIntakeScene(
				request,
				null,
				fakes({ scenes: () => ({ ok: true, scenes: {} }) })
			)
		).toBeNull()
		expect(
			await resolveIntakeScene(
				request,
				null,
				fakes({ getPublishedScenePreview: vi.fn(async () => null) })
			)
		).toBeNull()
	})

	it('reports a bad value or a failed read, and still renders the page', async () => {
		const reportServerError = vi.fn()
		expect(
			await resolveIntakeScene(
				request,
				null,
				fakes({
					scenes: () => ({ ok: false, error: 'nope' }),
					reportServerError
				})
			)
		).toBeNull()
		expect(
			await resolveIntakeScene(
				request,
				null,
				fakes({
					readEmbedSceneSettings: vi.fn(async () => {
						throw new Error('db down')
					}),
					reportServerError
				})
			)
		).toBeNull()
		expect(reportServerError).toHaveBeenCalledTimes(2)
	})

	it('keeps the embed without a poster when the scene hides its thumbnail', async () => {
		const scene = await resolveIntakeScene(
			request,
			null,
			fakes({ buildInlineEmbedManifest: vi.fn(async () => null) })
		)
		expect(scene).toEqual({
			embedPath: `/embed/${P}/${DEFAULT}?token=vctrl_a&${OPTIONS}`,
			posterUrl: null,
			title: null
		})
	})
})
