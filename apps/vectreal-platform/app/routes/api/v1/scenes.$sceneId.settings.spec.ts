import {
	apiFailureSchema,
	apiSuccessSchema,
	sceneSettingsSchema
} from '@vctrl/sdk'
import { RouterContextProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { action, loader } from './scenes.$sceneId.settings'
import {
	defaultBoundsOptions,
	defaultControlsOptions,
	defaultEnvOptions,
	defaultPresentationOptions,
	normalizeShadowOptions
} from '../../../constants/viewer-defaults'
import { agentActorContext } from '../../../lib/domain/agent/agent-actor-context'

import type { Route } from './+types/scenes.$sceneId.settings'
import type { SceneSettings } from '@vctrl/core'

const mocks = vi.hoisted(() => {
	class SceneSaveRefusedError extends Error {}
	return {
		SceneSaveRefusedError,
		recordAgentAudit: vi.fn(),
		withIdempotency: vi.fn(),
		resolveSceneMembership: vi.fn(),
		runWithSceneWriteLock: vi.fn(),
		readSceneSettingsWithin: vi.fn(),
		saveSceneSettingsWithin: vi.fn()
	}
})

// The gate is held to every route by tests/agent-api-routes.spec.ts; a
// handler here runs on the actor the gate would have put in context.
vi.mock('../../../lib/domain/agent/agent-request.server', () => ({
	agentGate: vi.fn()
}))

const contextFor = (actor: unknown) =>
	new RouterContextProvider(new Map([[agentActorContext, actor]]))
vi.mock('../../../lib/domain/agent/agent-audit.server', () => ({
	recordAgentAudit: mocks.recordAgentAudit
}))
vi.mock('../../../lib/domain/agent/agent-idempotency.server', () => ({
	withIdempotency: mocks.withIdempotency
}))
vi.mock('../../../lib/domain/dashboard/dashboard-permissions.server', () => ({
	resolveSceneMembership: mocks.resolveSceneMembership
}))
vi.mock('../../../lib/domain/scene/server/scene-request-guards.server', () => ({
	runWithSceneWriteLock: mocks.runWithSceneWriteLock
}))
vi.mock(
	'../../../lib/domain/scene/server/scene-settings-service.server',
	() => ({
		SceneSaveRefusedError: mocks.SceneSaveRefusedError,
		sceneSettingsService: {
			readSceneSettingsWithin: mocks.readSceneSettingsWithin,
			saveSceneSettingsWithin: mocks.saveSceneSettingsWithin
		}
	})
)
vi.mock('../../../db/client', () => ({
	getDbClient: () => ({
		transaction: (work: (tx: unknown) => unknown) => work(tx)
	})
}))

const SCENE = '3f2b6c1e-8a4d-4e7b-9c1a-2d5e6f7a8b9c'
const PROJECT = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const url = `https://vectreal.com/api/v1/scenes/${SCENE}/settings`
const actor = {
	grantId: 'grant-1',
	userId: 'user-1',
	organizationId: 'org-1',
	role: 'member',
	scopes: ['projects:read', 'scenes:write']
}
const tx = { transaction: 'tx' }

const bake = { assetId: 'asset-bake', signature: 'sig-1' }
const storedSettings: SceneSettings = {
	environment: { preset: 'studio-natural', environmentIntensity: 1 },
	shadows: { enabled: false, opacity: 0.9, baked: bake },
	controls: { autoRotate: false }
}
const stored = {
	settings: storedSettings,
	sceneAssetIds: ['asset-gltf', 'asset-bin', 'asset-bake'],
	sourceAssetId: 'asset-source'
}

const patch = (body: unknown) =>
	new Request(url, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	})

const act = (request: Request, sceneId = SCENE) =>
	action({
		request,
		params: { sceneId },
		context: contextFor(actor)
	} as unknown as Route.ActionArgs)
const read = (sceneId = SCENE) =>
	loader({
		request: new Request(url),
		params: { sceneId },
		context: contextFor(actor)
	} as unknown as Route.LoaderArgs)

async function refusal(promise: Promise<unknown>) {
	const thrown = await promise.then(
		(value) => value,
		(error: unknown) => error
	)
	expect(thrown).toBeInstanceOf(Response)
	const response = thrown as Response
	return { response, body: apiFailureSchema.parse(await response.json()) }
}

const savedSettings = () =>
	mocks.saveSceneSettingsWithin.mock.calls[0][1].settings as SceneSettings

beforeEach(() => {
	for (const fn of Object.values(mocks)) {
		if (typeof fn === 'function' && 'mockReset' in fn) fn.mockReset()
	}
	mocks.resolveSceneMembership.mockResolvedValue({
		organizationId: 'org-1',
		projectId: PROJECT,
		role: 'member',
		isResourceOwner: false
	})
	mocks.readSceneSettingsWithin.mockResolvedValue(stored)
	mocks.saveSceneSettingsWithin.mockResolvedValue({
		settings: {},
		removedAssetIds: []
	})
	mocks.recordAgentAudit.mockResolvedValue(undefined)
	mocks.runWithSceneWriteLock.mockImplementation(
		(_sceneId: string, _holder: string, operation: () => Promise<Response>) =>
			operation()
	)
	mocks.withIdempotency.mockImplementation(
		(_options, mutation: (t: unknown) => Promise<Response>) => mutation(tx)
	)
})

describe('GET /api/v1/scenes/:sceneId/settings', () => {
	it('answers the stored settings with defaults filled in', async () => {
		const response = await read()

		expect(mocks.resolveSceneMembership).toHaveBeenCalledWith(SCENE, 'user-1')
		expect(mocks.readSceneSettingsWithin).toHaveBeenCalledWith(tx, SCENE)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		const { settings } = apiSuccessSchema(sceneSettingsSchema).parse(
			await response.json()
		).data
		expect(settings.environment?.preset).toBe('studio-natural')
		// Filled from the defaults: the stored scene has no bounds.
		expect(settings.bounds).toMatchObject({ fit: true })
		expect(settings.hotspots).toEqual([])
	})

	it('answers every section a saved scene can hold in the shape the SDK reads', async () => {
		mocks.readSceneSettingsWithin.mockResolvedValue({
			...stored,
			settings: {
				...storedSettings,
				camera: {
					activeCameraId: 'default',
					cameras: [{ cameraId: 'default', name: 'Default', fov: 60 }]
				},
				interactions: [
					{
						trigger: { type: 'hotspot_click', hotspotId: 'h1' },
						actions: [{ type: 'set_camera', cameraId: 'default' }]
					}
				],
				animation: { enabled: true },
				presentation: { showInfoPopover: false },
				hotspots: [
					{
						id: 'h1',
						name: 'Seat',
						worldPosition: [0, 1, 0],
						visible: true,
						internalOnly: false,
						stylePreset: 'dot'
					}
				]
				// Shapes as stored, not every field core's types require.
			} as unknown as SceneSettings
		})

		const response = await read()

		const { settings } = apiSuccessSchema(sceneSettingsSchema).parse(
			await response.json()
		).data
		expect(settings.interactions).toHaveLength(1)
		expect(settings.hotspots).toHaveLength(1)
		expect(settings.presentation).toEqual({ showInfoPopover: false })
	})

	it('answers 404 for a scene in another organization, and reads nothing', async () => {
		mocks.resolveSceneMembership.mockResolvedValue({
			organizationId: 'org-2',
			projectId: PROJECT,
			role: 'owner'
		})

		const { response, body } = await refusal(read())

		expect(response.status).toBe(404)
		expect(body.code).toBe('not_found')
		expect(mocks.readSceneSettingsWithin).not.toHaveBeenCalled()
	})
})

describe('PATCH /api/v1/scenes/:sceneId/settings', () => {
	it('replaces the sections sent, keeps the rest and every asset link, audits it, and answers what was stored', async () => {
		const request = patch({ environment: { preset: 'night-city' } })

		const response = await act(request)

		expect(mocks.withIdempotency).toHaveBeenCalledWith(
			{
				grantId: 'grant-1',
				request,
				payload: {
					sceneId: SCENE,
					patch: { environment: { preset: 'night-city' } }
				}
			},
			expect.any(Function)
		)
		expect(mocks.saveSceneSettingsWithin).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({
				sceneId: SCENE,
				projectId: PROJECT,
				userId: 'user-1',
				sceneAssetIds: ['asset-gltf', 'asset-bin', 'asset-bake'],
				sourceAssetId: 'asset-source'
			})
		)
		// A section sent replaces the stored one, filled over its defaults.
		expect(savedSettings().environment).toEqual({
			...defaultEnvOptions,
			preset: 'night-city'
		})
		// The rest is saved as served, which is what the publisher saves too.
		expect(savedSettings().controls).toEqual({ autoRotate: false })
		expect(savedSettings().shadows).toEqual(
			normalizeShadowOptions(storedSettings.shadows)
		)
		expect(savedSettings().bounds).toEqual(defaultBoundsOptions)
		expect(mocks.recordAgentAudit).toHaveBeenCalledWith(
			tx,
			actor,
			'scene:update',
			SCENE
		)
		expect(response.status).toBe(200)
		expect(mocks.readSceneSettingsWithin).toHaveBeenCalledTimes(2)
	})

	it.each([
		['controls', { autoRotate: true }, defaultControlsOptions],
		['bounds', { margin: 2 }, defaultBoundsOptions]
	] as const)(
		'stores a sent %s section whole, the keys it leaves out at their defaults',
		async (section, sent, defaults) => {
			await act(patch({ [section]: sent }))

			expect(savedSettings()[section]).toEqual({ ...defaults, ...sent })
		}
	)

	it('saves a legacy contact-shadow row as every read shows it, not raw, when shadows were not sent', async () => {
		const legacy = { type: 'contact', enabled: true, opacity: 0.2, frames: 3 }
		mocks.readSceneSettingsWithin.mockResolvedValue({
			...stored,
			settings: { shadows: legacy } as unknown as SceneSettings
		})

		await act(patch({ controls: { autoRotate: true } }))

		expect(savedSettings().shadows).toEqual(
			normalizeShadowOptions(legacy as never)
		)
		expect(savedSettings().shadows?.opacity).not.toBe(0.2)
	})

	it('keeps the stored shadow bake and every link, whatever the patch sends', async () => {
		const response = await act(
			patch({
				shadows: {
					enabled: true,
					baked: { assetId: 'someone-elses-asset', signature: 'x' }
				}
			})
		)

		expect(response.status).toBe(200)
		expect(savedSettings().shadows).toEqual({
			...normalizeShadowOptions({ enabled: true }),
			baked: bake
		})
		expect(mocks.saveSceneSettingsWithin).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({
				sceneAssetIds: stored.sceneAssetIds,
				sourceAssetId: 'asset-source'
			})
		)
	})

	it.each([
		['as stored when the patch sends another value', false, true, false],
		[
			'absent when none is stored, whatever the patch sends',
			undefined,
			true,
			undefined
		]
	])(
		'keeps the publish-time texture setting %s',
		async (_case, storedCompress, sentCompress, savedCompress) => {
			mocks.readSceneSettingsWithin.mockResolvedValue({
				...stored,
				settings: {
					...storedSettings,
					presentation: {
						showInfoPopover: false,
						compressTexturesForGpu: storedCompress
					}
				}
			})

			const response = await act(
				patch({
					presentation: {
						showSceneViewReturn: false,
						compressTexturesForGpu: sentCompress
					}
				})
			)

			expect(response.status).toBe(200)
			expect(savedSettings().presentation?.compressTexturesForGpu).toBe(
				savedCompress
			)
		}
	)

	it('replaces presentation over the defaults, so an empty one resets every flag but when to start', async () => {
		mocks.readSceneSettingsWithin.mockResolvedValue({
			...stored,
			settings: {
				...storedSettings,
				presentation: { showInfoPopover: false, showLoadingThumbnail: true }
			}
		})

		await act(patch({ presentation: {} }))

		// A scene saved before `interactionStart` keeps starting right away.
		const { interactionStart: _newScenesOnly, ...defaults } =
			defaultPresentationOptions
		expect(savedSettings().presentation).toEqual(defaults)
	})

	it('holds the scene write lock around the whole save', async () => {
		await act(patch({ controls: { autoRotate: true } }))

		expect(mocks.runWithSceneWriteLock).toHaveBeenCalledWith(
			SCENE,
			expect.stringMatching(/^agent:grant-1:/),
			expect.any(Function),
			expect.any(Function)
		)
		expect(
			mocks.runWithSceneWriteLock.mock.invocationCallOrder[0]
		).toBeLessThan(mocks.withIdempotency.mock.invocationCallOrder[0])
	})

	it('answers 409 scene_busy while another save holds the lock, and saves nothing', async () => {
		mocks.runWithSceneWriteLock.mockImplementation(
			(_s: string, _h: string, _op: unknown, busy: () => Response) => busy()
		)

		const response = await act(patch({ controls: { autoRotate: true } }))

		expect(response.status).toBe(409)
		expect(response.headers.get('Retry-After')).toBe('1')
		expect(apiFailureSchema.parse(await response.json()).code).toBe(
			'scene_busy'
		)
		expect(mocks.withIdempotency).not.toHaveBeenCalled()
		expect(mocks.saveSceneSettingsWithin).not.toHaveBeenCalled()
	})

	it('refuses a scene the publisher could not save either, as a kept 400, and saves nothing', async () => {
		// The PATCH re-saves every section it did not send, through the same
		// parser, so a stored camera the parser refuses blocks it as it would
		// block a publisher save.
		mocks.readSceneSettingsWithin.mockResolvedValue({
			...stored,
			settings: { ...storedSettings, camera: { cameras: [] } }
		})

		const response = await act(patch({ controls: { autoRotate: true } }))

		expect(response.status).toBe(400)
		const body = apiFailureSchema.parse(await response.json())
		expect(body.code).toBe('invalid_request')
		expect(body.error).toBe('camera.cameras must be a non-empty array')
		expect(mocks.saveSceneSettingsWithin).not.toHaveBeenCalled()
		expect(mocks.recordAgentAudit).not.toHaveBeenCalled()
	})

	describe('cameras and hotspots', () => {
		const MARKER = '5d1c9a7e-3b2f-4e6a-8c4d-7f9e0a1b2c3d'
		const hero = {
			cameraId: 'hero',
			name: 'Hero',
			kind: 'scene',
			position: [2, 1.5, 3],
			target: [0, 0.5, 0],
			fov: 40
		}
		const detail = {
			cameraId: 'detail',
			name: 'Detail',
			kind: 'hotspot',
			position: [0.4, 0.6, 0.8],
			target: [0, 0.5, 0],
			fov: 30
		}
		const marker = {
			id: MARKER,
			name: 'Buckle',
			worldPosition: [0, 0.5, 0.2],
			visible: true,
			internalOnly: false,
			stylePreset: 'dot',
			linkedCameraId: 'detail'
		}

		it('stores them through the save parser, opening on the first scene camera', async () => {
			const response = await act(
				patch({
					camera: { activeCameraId: 'detail', cameras: [detail, hero] },
					hotspots: [marker]
				})
			)

			expect(response.status).toBe(200)
			expect(savedSettings().camera?.activeCameraId).toBe('hero')
			expect(savedSettings().camera?.cameras).toEqual([
				{ ...detail, initial: false },
				{ ...hero, initial: true }
			])
			expect(savedSettings().hotspots).toEqual([marker])
		})

		/**
		 * The order of scene cameras is the order the switcher steps through,
		 * and the first is the opening view, the same rule the Publisher's
		 * camera list writes by. An agent reordering them gets that, whatever
		 * `activeCameraId` it sends.
		 */
		it('keeps the scene cameras in the order sent, opening on the first', async () => {
			const side = { ...hero, cameraId: 'side', name: 'Side' }
			const response = await act(
				patch({
					camera: { activeCameraId: 'hero', cameras: [side, detail, hero] },
					hotspots: [marker]
				})
			)

			expect(response.status).toBe(200)
			expect(savedSettings().camera?.activeCameraId).toBe('side')
			expect(
				savedSettings().camera?.cameras?.map(({ cameraId, initial }) => [
					cameraId,
					initial
				])
			).toEqual([
				['side', true],
				['detail', false],
				['hero', false]
			])
		})

		it('refuses a hotspot linked to a camera the scene does not have, and saves nothing', async () => {
			const response = await act(
				patch({ camera: { cameras: [hero] }, hotspots: [marker] })
			)
			const body = apiFailureSchema.parse(await response.json())

			expect(response.status).toBe(400)
			expect(body.error).toBe(
				"hotspots[0].linkedCameraId references unknown camera 'detail'"
			)
			expect(mocks.saveSceneSettingsWithin).not.toHaveBeenCalled()
		})
	})

	describe('hotspot artwork, re-saved with every PATCH', () => {
		const LINKED = '0b7c1f9e-2d4a-4c8b-9e6f-1a2b3c4d5e6f'
		const OTHER_SCENE = '9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b'
		const storedWithMarker = (payloadUrl: string) => ({
			...stored,
			sceneAssetIds: [...stored.sceneAssetIds, LINKED],
			settings: {
				...storedSettings,
				hotspots: [
					{
						id: '5c4b3a29-1807-4f6e-9d5c-4b3a29180716',
						name: 'Seat',
						worldPosition: [0, 1, 0],
						visible: true,
						internalOnly: false,
						stylePreset: 'image',
						payloadUrl
					}
				]
			} as SceneSettings
		})

		it('saves artwork that names an asset this scene links', async () => {
			mocks.readSceneSettingsWithin.mockResolvedValue(
				storedWithMarker(`/api/scenes/${SCENE}/assets/${LINKED}`)
			)

			const response = await act(patch({ controls: { autoRotate: true } }))

			expect(response.status).toBe(200)
			expect(savedSettings().hotspots?.[0]?.payloadUrl).toBe(
				`/api/scenes/${SCENE}/assets/${LINKED}`
			)
		})

		it.each([
			['another scene', `/api/scenes/${OTHER_SCENE}/assets/${LINKED}`],
			[
				'an asset this scene does not link',
				`/api/scenes/${SCENE}/assets/7f6e5d4c-3b2a-4190-8f7e-6d5c4b3a2918`
			]
		])('refuses artwork that names %s, and saves nothing', async (_, url) => {
			mocks.readSceneSettingsWithin.mockResolvedValue(storedWithMarker(url))

			const response = await act(patch({ controls: { autoRotate: true } }))

			expect(response.status).toBe(400)
			expect(apiFailureSchema.parse(await response.json())).toMatchObject({
				code: 'invalid_request',
				error: expect.stringContaining('Marker "Seat"')
			})
			expect(mocks.saveSceneSettingsWithin).not.toHaveBeenCalled()
		})
	})

	it('answers a refused save, such as remote hotspot artwork, as a 400', async () => {
		mocks.saveSceneSettingsWithin.mockRejectedValue(
			new mocks.SceneSaveRefusedError(
				'Marker "A" links artwork from another site.'
			)
		)

		const response = await act(patch({ controls: { autoRotate: true } }))

		expect(response.status).toBe(400)
		expect(apiFailureSchema.parse(await response.json()).error).toContain(
			'Marker "A"'
		)
		expect(mocks.recordAgentAudit).not.toHaveBeenCalled()
	})

	it('lets any other failure propagate, so the transaction rolls back', async () => {
		const failure = new Error('db down')
		mocks.saveSceneSettingsWithin.mockRejectedValue(failure)

		await expect(act(patch({ controls: {} }))).rejects.toBe(failure)
	})

	it.each([
		['a section the API does not have', { grid: {} }],
		[
			'two lights of one role',
			{ lighting: { lights: [{ role: 'key' }, { role: 'key' }] } }
		],
		['a section that is not an object', { environment: 'night' }],
		['a look value of the wrong type', { shadows: { opacity: 'dark' } }],
		// The publisher derives other state from the model when these change.
		['normalization', { normalization: { enabled: true } }],
		['interactions', { interactions: [] }],
		['animation', { animation: {} }],
		['an unknown presentation flag', { presentation: { showGrid: true } }],
		['a body that is not JSON', 'not json'],
		['an array', [{ environment: {} }]]
	])(
		'refuses %s with 400, before taking the lock or a key',
		async (_, body) => {
			const { response, body: failure } = await refusal(act(patch(body)))

			expect(response.status).toBe(400)
			expect(failure.code).toBe('invalid_request')
			expect(mocks.runWithSceneWriteLock).not.toHaveBeenCalled()
			expect(mocks.withIdempotency).not.toHaveBeenCalled()
		}
	)
})

describe('/api/v1/scenes/:sceneId/settings, either handler', () => {
	it('answers 404 for a scene id that is not a uuid, without a query', async () => {
		const { response } = await refusal(act(patch({}), 'not-a-uuid'))

		expect(response.status).toBe(404)
		expect(mocks.resolveSceneMembership).not.toHaveBeenCalled()
	})

	it("refuses a PATCH with 403 when the user's role may not edit", async () => {
		mocks.resolveSceneMembership.mockResolvedValue({
			organizationId: 'org-1',
			projectId: PROJECT,
			role: 'guest'
		})

		const { response, body } = await refusal(act(patch({ controls: {} })))

		expect(response.status).toBe(403)
		expect(body.code).toBe('insufficient_role')
		// Every role holds both operations today, so the denial's wording is
		// what shows the PATCH checked editing rather than reading.
		expect(body.error).toContain('edit this scene')
		expect(mocks.withIdempotency).not.toHaveBeenCalled()
	})

	it("refuses a GET with 403 naming viewing when the user's role may not", async () => {
		mocks.resolveSceneMembership.mockResolvedValue({
			organizationId: 'org-1',
			projectId: PROJECT,
			role: 'guest'
		})

		const { response, body } = await refusal(read())

		expect(response.status).toBe(403)
		expect(body.error).toContain('view this scene')
		expect(mocks.readSceneSettingsWithin).not.toHaveBeenCalled()
	})
})
