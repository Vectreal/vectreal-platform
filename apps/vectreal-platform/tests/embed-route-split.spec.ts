import { describe, expect, it } from 'vitest'

import {
	buildEmbedPath,
	buildInternalPreviewPath
} from '../app/lib/domain/embed/embed-snippet'
import { parseSceneRouteParams } from '../app/lib/domain/scene/scene-route-params'
import { loader as legacyEmbedRedirectLoader } from '../app/routes/embed-page/legacy-embed-redirect'

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

// Both ids reach Postgres as uuid-typed parameters, so a malformed value raises
// a driver error rather than returning no rows. Unguarded, that is a 500 on
// input anyone can send to the public /embed route.
describe('parseSceneRouteParams', () => {
	const VALID_PROJECT = '395a09f0-9340-42f2-ac98-03339cf27c9c'
	const VALID_SCENE = '488bd4a1-46d3-4ee1-8497-25f68a5d6fa2'

	it('accepts a well-formed pair', () => {
		expect(
			parseSceneRouteParams({
				projectId: VALID_PROJECT,
				sceneId: VALID_SCENE
			})
		).toEqual({
			ok: true,
			value: { projectId: VALID_PROJECT, sceneId: VALID_SCENE }
		})
	})

	it('trims surrounding whitespace', () => {
		expect(
			parseSceneRouteParams({
				projectId: ` ${VALID_PROJECT} `,
				sceneId: `\t${VALID_SCENE}\n`
			})
		).toEqual({
			ok: true,
			value: { projectId: VALID_PROJECT, sceneId: VALID_SCENE }
		})
	})

	it.each([
		['both absent', undefined, undefined],
		['project absent', undefined, VALID_SCENE],
		['scene absent', VALID_PROJECT, undefined],
		['whitespace only', '   ', VALID_SCENE]
	])('reports %s as missing', (_label, projectId, sceneId) => {
		expect(parseSceneRouteParams({ projectId, sceneId })).toEqual({
			ok: false,
			reason: 'missing'
		})
	})

	it.each([
		['non-uuid project id', 'P1', VALID_SCENE],
		['non-uuid scene id', VALID_PROJECT, 'S1'],
		['both malformed', 'P1', 'S1'],
		['uuid missing a section', '395a09f0-9340-42f2-03339cf27c9c', VALID_SCENE],
		['uuid with a trailing segment', `${VALID_PROJECT}-extra`, VALID_SCENE],
		['sql-ish input', "' OR 1=1--", VALID_SCENE]
	])('reports %s as malformed', (_label, projectId, sceneId) => {
		expect(parseSceneRouteParams({ projectId, sceneId })).toEqual({
			ok: false,
			reason: 'malformed'
		})
	})
})
