import { describe, expect, it } from 'vitest'

import { loader as legacyEmbedRedirectLoader } from '../app/routes/embed-page/legacy-embed-redirect'
import {
	buildEmbedPath,
	buildInternalPreviewPath
} from '../app/lib/domain/embed/embed-snippet'

const PROJECT_ID = 'proj-1'
const SCENE_ID = 'scene-1'

function legacyRequest(search = ''): Request {
	return new Request(
		`https://vectreal.com/preview/fullscreen/${PROJECT_ID}/${SCENE_ID}/${search}`
	)
}

function runLegacyLoader(search = ''): Response {
	return legacyEmbedRedirectLoader({
		request: legacyRequest(search),
		params: { projectId: PROJECT_ID, sceneId: SCENE_ID },
		context: {} as never
	} as never) as Response
}

describe('embed and preview path builders', () => {
	it('builds the external embed path', () => {
		expect(buildEmbedPath({ projectId: PROJECT_ID, sceneId: SCENE_ID })).toBe(
			'/embed/proj-1/scene-1'
		)
	})

	it('builds the internal preview path', () => {
		expect(
			buildInternalPreviewPath({ projectId: PROJECT_ID, sceneId: SCENE_ID })
		).toBe('/preview/proj-1/scene-1')
	})

	it('keeps the two surfaces on distinct prefixes', () => {
		const embed = buildEmbedPath({ projectId: PROJECT_ID, sceneId: SCENE_ID })
		const preview = buildInternalPreviewPath({
			projectId: PROJECT_ID,
			sceneId: SCENE_ID
		})

		expect(embed.startsWith('/embed/')).toBe(true)
		expect(preview.startsWith('/preview/')).toBe(true)
		expect(embed).not.toBe(preview)
	})
})

describe('legacy embed redirect', () => {
	it('redirects permanently so search engines and caches follow', () => {
		expect(runLegacyLoader().status).toBe(301)
	})

	it('points at the new embed path', () => {
		expect(runLegacyLoader().headers.get('Location')).toBe(
			'/embed/proj-1/scene-1'
		)
	})

	// Every embed in the wild carries ?token=; the docs also pass camera,
	// autoRotate, and transition. Dropping the query would break all of them.
	it('preserves the full query string', () => {
		const location = runLegacyLoader(
			'?token=abc123&camera=hero&autoRotate=0&transition=linear'
		).headers.get('Location')

		expect(location).toBe(
			'/embed/proj-1/scene-1?token=abc123&camera=hero&autoRotate=0&transition=linear'
		)
	})

	it('preserves a token containing url-encoded characters', () => {
		expect(runLegacyLoader('?token=a%2Bb%2Fc%3D').headers.get('Location')).toBe(
			'/embed/proj-1/scene-1?token=a%2Bb%2Fc%3D'
		)
	})
})
