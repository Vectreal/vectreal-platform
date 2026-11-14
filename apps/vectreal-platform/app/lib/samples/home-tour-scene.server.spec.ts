/**
 * The home tour's scene comes from config per request, because the home page
 * is prerendered once for both deployments. Unset is no tour and no noise;
 * a value that is not an embed URL is reported, and is no tour either.
 */
import { describe, expect, it, vi } from 'vitest'

import {
	homeTourDeps,
	resolveHomeTour,
	type HomeTourDeps
} from './home-tour-scene.server'

vi.mock('../domain/scene/server/scene-preview-repository.server', () => ({
	getPublishedScenePreview: vi.fn()
}))
vi.mock('../domain/scene/server/scene-manifest.server', () => ({
	readEmbedSceneSettings: vi.fn()
}))
vi.mock('../domain/embed/inline-embed-manifest.server', () => ({
	buildInlineEmbedManifest: vi.fn()
}))

const P = '6f1c2a0e-1b7d-4c55-9a0e-0d3b9f6c1a11'
const S = '92aae012-e003-4b65-8bd8-dfd4dcd6399d'
const request = new Request('https://vectreal.com/api/home-tour')

function fakes(raw: string | undefined): HomeTourDeps {
	return {
		...homeTourDeps,
		raw: () => raw,
		getPublishedScenePreview: vi.fn(async () => ({}) as never),
		readEmbedSceneSettings: vi.fn(async () => ({}) as never),
		buildInlineEmbedManifest: vi.fn(async () => ({
			meta: { name: 'Camera', description: '', thumbnailUrl: '' },
			assetRefs: {}
		})) as never,
		reportServerError: vi.fn()
	}
}

describe('resolveHomeTour', () => {
	it('is no tour, and reports nothing, while the variable is unset', async () => {
		const deps = fakes(undefined)
		expect(await resolveHomeTour(request, deps)).toBeNull()
		expect(await resolveHomeTour(request, fakes('  '))).toBeNull()
		expect(deps.reportServerError).not.toHaveBeenCalled()
	})

	it('reports a value that is not an embed URL with a token, and tours nothing', async () => {
		const deps = fakes(`https://vectreal.com/embed/${P}/${S}`)
		expect(await resolveHomeTour(request, deps)).toBeNull()
		expect(deps.reportServerError).toHaveBeenCalledOnce()
	})

	it('names the scene by its embed path, toured: no switcher, markers, hint or turn', async () => {
		const scene = await resolveHomeTour(
			request,
			fakes(`https://vectreal.com/embed/${P}/${S}?token=vctrl_x`)
		)
		const embed = new URL(scene?.embedPath ?? '', 'http://localhost')
		expect(embed.pathname).toBe(`/embed/${P}/${S}`)
		expect(Object.fromEntries(embed.searchParams)).toEqual({
			token: 'vctrl_x',
			cameraControls: '0',
			hotspots: '0',
			hint: '0',
			autoRotate: '0'
		})
		expect(scene?.title).toBe('Camera')
	})

	it('is no tour while the scene is not published', async () => {
		const deps = fakes(`https://vectreal.com/embed/${P}/${S}?token=vctrl_x`)
		deps.getPublishedScenePreview = vi.fn(async () => null) as never
		expect(await resolveHomeTour(request, deps)).toBeNull()
	})
})
