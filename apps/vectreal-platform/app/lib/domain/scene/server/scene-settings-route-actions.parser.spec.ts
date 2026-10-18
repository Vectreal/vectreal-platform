import { SceneSettingsParser } from './scene-settings.parser.server'

/**
 * The three actions `routes/api/scenes.$sceneId.ts` used to parse inline:
 * the metadata edit, the presentation write, and the ids an upload names.
 * Moved verbatim; these pin what the route did.
 */

const ROUTE_SCENE = '11111111-1111-4111-8111-111111111111'

async function refusal(result: unknown) {
	expect(result).toBeInstanceOf(Response)
	const response = result as Response
	expect(response.status).toBe(400)
	return ((await response.json()) as { error: string }).error
}

describe('the scene metadata edit', () => {
	const parse = SceneSettingsParser.parseSceneMetadataUpdate

	it('trims the name and keeps the description as typed', () => {
		expect(parse({ name: '  Camera  ', description: ' A lens ' })).toEqual({
			name: 'Camera',
			description: ' A lens '
		})
	})

	it('stores a description that is not a string as none', () => {
		expect(parse({ name: 'Camera', description: 5 })).toEqual({
			name: 'Camera',
			description: null
		})
		expect(parse({ name: 'Camera' })).toEqual({
			name: 'Camera',
			description: null
		})
	})

	it.each([undefined, '   ', 5])('refuses a name of %j', async (name) => {
		expect(await refusal(parse({ name, description: 'x' }))).toBe(
			'Scene name is required'
		)
	})
})

describe('the presentation write', () => {
	const parse = SceneSettingsParser.parseScenePresentationUpdate

	it('keeps only the fields the app understands', () => {
		expect(
			parse({ presentation: { showLoadingThumbnail: true, other: 1 } })
		).toEqual({ showLoadingThumbnail: true })
	})

	it.each([undefined, 'x', [], {}, { other: 1 }])(
		'refuses %j as nothing it understands',
		async (presentation) => {
			expect(await refusal(parse({ presentation }))).toBe(
				'Presentation settings are required'
			)
		}
	)
})

describe('the ids an upload names', () => {
	const parse = (body: Record<string, unknown>, routeSceneId?: string) =>
		SceneSettingsParser.parseSceneUploadRequest(
			body,
			'upload-scene-asset',
			routeSceneId
		)

	it('trims every id and reads an empty one as absent', () => {
		expect(
			parse({
				requestId: ' r1 ',
				projectId: ' p1 ',
				sceneId: ' s1 ',
				targetProjectId: ' p2 ',
				targetFolderId: ' f1 '
			})
		).toEqual({
			action: 'upload-scene-asset',
			requestId: 'r1',
			projectId: 'p1',
			sceneId: 's1',
			targetProjectId: 'p2',
			targetFolderId: 'f1'
		})
	})

	it('reads an empty folder as null, meaning the project root', () => {
		expect(parse({ targetFolderId: '  ' }).targetFolderId).toBeNull()
	})

	it('keeps an empty request id empty rather than absent', () => {
		expect(parse({ requestId: '  ' }).requestId).toBe('')
	})

	it('falls back to the route scene only when the body names none', () => {
		expect(parse({}, ROUTE_SCENE).sceneId).toBe(ROUTE_SCENE)
		expect(parse({ sceneId: 5 }, ROUTE_SCENE).sceneId).toBe(ROUTE_SCENE)
		expect(parse({ sceneId: '  ' }, ROUTE_SCENE).sceneId).toBeUndefined()
	})

	it('treats a value that is not a string as absent', () => {
		expect(
			parse({
				requestId: 1,
				projectId: 1,
				targetProjectId: 1,
				targetFolderId: 1
			})
		).toEqual({
			action: 'upload-scene-asset',
			requestId: undefined,
			projectId: undefined,
			sceneId: undefined,
			targetProjectId: undefined,
			targetFolderId: undefined
		})
	})
})
