import { SceneSettingsParser } from './scene-settings.parser.server'

import type { SceneSettingsRequest } from '../../../../types/api'

/**
 * The request envelope around the settings: which actions need what, and how
 * each top-level field is read.
 *
 * Written to pin behavior before the parser was split into modules, so these
 * assert what the parser does, including the parts that look odd (a
 * non-string `gltfJson` is ignored). Change an expectation only on purpose.
 */

const SCENE = '11111111-1111-4111-8111-111111111111'
const ASSET = '22222222-2222-4222-8222-222222222222'
const PROJECT = '33333333-3333-4333-8333-333333333333'
const PUBLISHED = '44444444-4444-4444-8444-444444444444'

const CAMERA = { cameras: [{ cameraId: 'hero', name: 'Hero', kind: 'scene' }] }

const parse = (fields: Record<string, unknown>) =>
	SceneSettingsParser.parseSceneSettingsRequestData({
		action: 'update',
		sceneId: SCENE,
		settings: { camera: CAMERA },
		...fields
	})

const parsed = (result: SceneSettingsRequest | Response) => {
	if (result instanceof Response) throw new Error('expected a parsed request')
	return result
}

async function refusal(result: SceneSettingsRequest | Response) {
	expect(result).toBeInstanceOf(Response)
	const response = result as Response
	expect(response.status).toBe(400)
	return ((await response.json()) as { error: string }).error
}

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('actions', () => {
	it('requires an action', async () => {
		expect(await refusal(parse({ action: '' }))).toBe('Action is required')
	})

	it.each(['get-scene-settings', 'revoke-scene-publish'])(
		'reads %s without a settings payload',
		(action) => {
			expect(
				parsed(parse({ action, settings: undefined, requestId: ' r1 ' }))
			).toEqual({
				action,
				requestId: 'r1',
				projectId: undefined,
				sceneId: SCENE,
				targetProjectId: undefined,
				targetFolderId: undefined,
				settings: undefined,
				gltfJson: undefined
			})
		}
	)

	it.each([
		'get-scene-settings',
		'revoke-scene-publish',
		'commit-scene-publish'
	])('requires a scene id for %s', async (action) => {
		expect(await refusal(parse({ action, sceneId: undefined }))).toBe(
			'Scene ID is required'
		)
	})

	it('refuses a malformed scene id for any action', async () => {
		expect(await refusal(parse({ sceneId: 'scene-1' }))).toBe(
			'Scene ID must be a valid UUID format'
		)
	})

	it.each([
		[
			'publish-scene',
			'publish-scene is no longer supported. Use upload-published-glb + commit-scene-publish.'
		],
		[
			'save-scene-settings',
			'save-scene-settings is no longer supported. Use upload-scene-asset/upload-scene-gltf + commit-scene-save.'
		]
	])('refuses the retired %s', async (action, message) => {
		expect(await refusal(parse({ action }))).toBe(message)
	})

	it('reads commit-scene-publish with only its published asset id', () => {
		expect(
			parsed(
				parse({
					action: 'commit-scene-publish',
					settings: undefined,
					publishedAssetId: ` ${PUBLISHED} `
				})
			)
		).toMatchObject({
			action: 'commit-scene-publish',
			publishedAssetId: PUBLISHED,
			settings: undefined
		})
	})

	it.each([
		[undefined, 'publishedAssetId is required'],
		['  ', 'publishedAssetId is required'],
		['asset-1', 'publishedAssetId must be a valid UUID']
	])('refuses a published asset id of %j', async (value, message) => {
		expect(
			await refusal(
				parse({ action: 'commit-scene-publish', publishedAssetId: value })
			)
		).toBe(message)
	})

	it('requires a scene id or a glTF document for any other action', async () => {
		expect(await refusal(parse({ sceneId: undefined }))).toBe(
			'Scene ID is required for this action'
		)
		expect(
			parsed(parse({ sceneId: undefined, gltfJson: '{"asset":{}}' })).gltfJson
		).toEqual({ asset: {} })
	})
})

describe('the settings payload', () => {
	it('reads settings from a JSON string or an object', () => {
		const fromString = parsed(
			parse({ settings: JSON.stringify({ camera: CAMERA }) })
		)
		const fromObject = parsed(parse({}))
		expect(fromString.settings).toEqual(fromObject.settings)
	})

	it('falls back to settingsData when settings is absent', () => {
		expect(
			parsed(parse({ settings: undefined, settingsData: { camera: CAMERA } }))
				.settings?.camera?.activeCameraId
		).toBe('hero')
	})

	it.each([
		[{ settings: '{bad' }, 'Invalid settings data format'],
		[
			{ settings: undefined, settingsData: '{bad' },
			'Invalid settings data format'
		],
		[{ settings: undefined }, 'Settings must be a valid object'],
		[{ settings: [] }, 'Settings must be a valid object'],
		[{ settings: '[1]' }, 'Settings must be a valid object']
	])('refuses %j', async (fields, message) => {
		expect(await refusal(parse(fields))).toBe(message)
	})
})

describe('the scene transition', () => {
	const transition = (sceneTransition: unknown) =>
		parse({ settings: { camera: { ...CAMERA, sceneTransition } } })

	// Validated, never rewritten: the viewer fills object-avoidance defaults
	// where it plays the transition, so the parser storing them would be a
	// second owner of the same numbers.
	it('is validated but stored exactly as sent', () => {
		const sent = { type: 'object_avoidance', objectAvoidance: {} }
		expect(parsed(transition(sent)).settings?.camera?.sceneTransition).toEqual(
			sent
		)
	})

	it.each([
		['x', 'camera.sceneTransition must be an object'],
		[
			{ type: 'warp' },
			'camera.sceneTransition.type must be one of linear, object_avoidance, none'
		],
		[
			{ type: 'linear', duration: -1 },
			'camera.sceneTransition.duration must be a non-negative number'
		],
		[
			{ type: 'linear', easing: 'bounce' },
			'camera.sceneTransition.easing must be one of linear, ease_in, ease_out, ease_in_out'
		],
		[
			{ type: 'object_avoidance', objectAvoidance: 'x' },
			'camera.sceneTransition.objectAvoidance must be an object when provided'
		],
		[
			{ type: 'object_avoidance', objectAvoidance: { clearance: 'x' } },
			'camera.sceneTransition.objectAvoidance.clearance must be a number'
		],
		[
			{ type: 'object_avoidance', objectAvoidance: { arcHeight: Number.NaN } },
			'camera.sceneTransition.objectAvoidance.arcHeight must be a number'
		],
		[
			{ type: 'object_avoidance', objectAvoidance: { samples: 1 } },
			'camera.sceneTransition.objectAvoidance.samples must be a number >= 2'
		],
		[
			{ type: 'object_avoidance', objectAvoidance: { tension: 'x' } },
			'camera.sceneTransition.objectAvoidance.tension must be a number'
		]
	])('refuses %j', async (sceneTransition, message) => {
		expect(await refusal(transition(sceneTransition))).toBe(message)
	})

	it('ignores object avoidance fields on another transition type', () => {
		expect(
			parsed(transition({ type: 'linear', objectAvoidance: { samples: 1 } }))
				.settings?.camera?.sceneTransition
		).toEqual({ type: 'linear', objectAvoidance: { samples: 1 } })
	})
})

describe('top-level fields', () => {
	it.each(['projectId', 'targetProjectId'])(
		'reads %s as a trimmed UUID, empty as absent',
		async (field) => {
			expect(
				parsed(parse({ [field]: ` ${PROJECT} ` }))[field as 'projectId']
			).toBe(PROJECT)
			expect(
				parsed(parse({ [field]: '  ' }))[field as 'projectId']
			).toBeUndefined()
			expect(await refusal(parse({ [field]: 'project-1' }))).toBe(
				`${field} must be a valid UUID`
			)
			expect(await refusal(parse({ [field]: 5 }))).toBe(
				`${field} must be a valid UUID`
			)
		}
	)

	it('reads targetFolderId empty as null, meaning the project root', async () => {
		expect(parsed(parse({ targetFolderId: '  ' })).targetFolderId).toBeNull()
		expect(parsed(parse({ targetFolderId: ` ${ASSET} ` })).targetFolderId).toBe(
			ASSET
		)
		expect(await refusal(parse({ targetFolderId: 'folder-1' }))).toBe(
			'targetFolderId must be a valid UUID'
		)
	})

	it('reads gltfJson only from a JSON string holding an object', async () => {
		expect(parsed(parse({ gltfJson: { asset: {} } })).gltfJson).toBeUndefined()
		expect(await refusal(parse({ gltfJson: '{bad' }))).toBe(
			'Invalid gltfJson format'
		)
		expect(await refusal(parse({ gltfJson: '5' }))).toBe(
			'Invalid gltfJson format'
		)
	})

	it('reads optimization settings from a string or an object', async () => {
		expect(
			parsed(parse({ optimizationSettings: '{"draco":true}' }))
				.optimizationSettings
		).toEqual({ draco: true })
		expect(
			parsed(parse({ optimizationSettings: { draco: true } }))
				.optimizationSettings
		).toEqual({ draco: true })
		expect(
			parsed(parse({ optimizationSettings: 5 })).optimizationSettings
		).toBeUndefined()
		expect(await refusal(parse({ optimizationSettings: 'null' }))).toBe(
			'Invalid optimization settings format'
		)
	})

	it('refuses an optimization report that fails its guard', async () => {
		expect(await refusal(parse({ optimizationReport: '{bad' }))).toBe(
			'Invalid optimization report format'
		)
		expect(await refusal(parse({ optimizationReport: {} }))).toBe(
			'Invalid optimization report format'
		)
	})

	it('rounds initialSceneBytes and refuses a negative or non-number', async () => {
		expect(parsed(parse({ initialSceneBytes: '20.6' })).initialSceneBytes).toBe(
			21
		)
		expect(
			parsed(parse({ initialSceneBytes: null })).initialSceneBytes
		).toBeUndefined()
		for (const value of [-1, 'x', {}]) {
			expect(await refusal(parse({ initialSceneBytes: value }))).toBe(
				'initialSceneBytes must be a non-negative number'
			)
		}
	})

	it('reads meta field by field, defaulting each to empty', async () => {
		expect(parsed(parse({ meta: { name: 5, description: 'B' } })).meta).toEqual(
			{
				name: '',
				description: 'B',
				thumbnailUrl: ''
			}
		)
		expect(await refusal(parse({ meta: '[]' }))).toBe(
			'Invalid scene metadata format'
		)
		expect(await refusal(parse({ meta: '{bad' }))).toBe(
			'Invalid scene metadata format'
		)
	})
})

describe('commit-scene-save asset ids', () => {
	const commit = (fields: Record<string, unknown>) =>
		parse({ action: 'commit-scene-save', sceneAssetIds: [ASSET], ...fields })

	it('reads sceneAssetIds from an array or a JSON string, trimmed', () => {
		expect(
			parsed(commit({ sceneAssetIds: [` ${ASSET} `] })).sceneAssetIds
		).toEqual([ASSET])
		expect(
			parsed(commit({ sceneAssetIds: JSON.stringify([ASSET]) })).sceneAssetIds
		).toEqual([ASSET])
	})

	it.each([
		[undefined, 'sceneAssetIds is required'],
		['[bad', 'sceneAssetIds must be a valid JSON array'],
		[[], 'sceneAssetIds must be a non-empty array'],
		[[ASSET, ' '], 'sceneAssetIds contains invalid values'],
		[['asset-1'], 'sceneAssetIds must contain valid UUIDs']
	])('refuses sceneAssetIds of %j', async (sceneAssetIds, message) => {
		expect(await refusal(commit({ sceneAssetIds }))).toBe(message)
	})
})
