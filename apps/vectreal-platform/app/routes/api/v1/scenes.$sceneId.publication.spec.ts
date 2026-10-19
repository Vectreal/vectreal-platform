import { createHash } from 'node:crypto'

import {
	apiFailureSchema,
	apiSuccessSchema,
	scenePublicationSchema
} from '@vctrl/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { action, loader } from './scenes.$sceneId.publication'
import { EntitlementRequiredError } from '../../../lib/domain/billing/entitlement-required-error'
import { QuotaExceededError } from '../../../lib/domain/billing/quota-exceeded-error'

import type { Route } from './+types/scenes.$sceneId.publication'
import type { StagedMutation } from '../../../lib/domain/agent/agent-idempotency.server'

const mocks = vi.hoisted(() => ({
	authorizeAgentRequest: vi.fn(),
	recordAgentAudit: vi.fn(),
	withIdempotency: vi.fn(),
	resolveSceneMembership: vi.fn(),
	requirePublishEntitlement: vi.fn(),
	assertPublishLimits: vi.fn(),
	storePublishedGlb: vi.fn(),
	reclaimUploadBatch: vi.fn(),
	publishSceneWithin: vi.fn(),
	revokeScenePublicationWithin: vi.fn(),
	collectUnreferencedAssets: vi.fn()
}))

vi.mock('../../../lib/domain/agent/agent-request.server', () => ({
	authorizeAgentRequest: mocks.authorizeAgentRequest
}))
vi.mock('../../../lib/domain/agent/agent-audit.server', () => ({
	recordAgentAudit: mocks.recordAgentAudit
}))
vi.mock('../../../lib/domain/agent/agent-idempotency.server', () => ({
	withIdempotency: mocks.withIdempotency
}))
vi.mock('../../../lib/domain/dashboard/dashboard-permissions.server', () => ({
	resolveSceneMembership: mocks.resolveSceneMembership
}))
vi.mock(
	'../../../lib/domain/scene/server/scene-publish.operations.server',
	() => ({
		requirePublishEntitlement: mocks.requirePublishEntitlement,
		assertPublishLimits: mocks.assertPublishLimits
	})
)
vi.mock(
	'../../../lib/domain/scene/server/scene-upload.operations.server',
	() => ({
		storePublishedGlb: mocks.storePublishedGlb
	})
)
vi.mock('../../../lib/domain/asset/asset-reclaim.server', () => ({
	reclaimUploadBatch: mocks.reclaimUploadBatch
}))
vi.mock(
	'../../../lib/domain/scene/server/scene-settings-service.server',
	() => ({
		sceneSettingsService: {
			publishSceneWithin: mocks.publishSceneWithin,
			revokeScenePublicationWithin: mocks.revokeScenePublicationWithin,
			collectUnreferencedAssets: mocks.collectUnreferencedAssets
		}
	})
)

/** The smallest valid GLB: a JSON chunk and nothing else. */
function glbBytes(): Uint8Array<ArrayBuffer> {
	const json = new TextEncoder().encode(
		JSON.stringify({ asset: { version: '2.0' } })
	)
	const chunk = new Uint8Array(Math.ceil(json.byteLength / 4) * 4).fill(0x20)
	chunk.set(json)
	const out = new Uint8Array(20 + chunk.byteLength)
	const view = new DataView(out.buffer)
	view.setUint32(0, 0x46546c67, true)
	view.setUint32(4, 2, true)
	view.setUint32(8, out.byteLength, true)
	view.setUint32(12, chunk.byteLength, true)
	view.setUint32(16, 0x4e4f534a, true)
	out.set(chunk, 20)
	return out
}

const SCENE = '3f2b6c1e-8a4d-4e7b-9c1a-2d5e6f7a8b9c'
const PROJECT = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const url = `https://vectreal.com/api/v1/scenes/${SCENE}/publication`
const actor = {
	grantId: 'grant-1',
	userId: 'user-1',
	organizationId: 'org-1',
	role: 'member',
	scopes: ['projects:read', 'scenes:publish']
}
const tx = { transaction: 'tx' }
const publishedAt = new Date('2026-10-19T08:00:00.000Z')

const post = (file: Blob | string | null = new Blob([glbBytes()])) => {
	const form = new FormData()
	if (file !== null) form.set('file', file)
	return new Request(url, { method: 'POST', body: form })
}
const del = () => new Request(url, { method: 'DELETE' })

const act = (request: Request, sceneId = SCENE) =>
	action({ request, params: { sceneId } } as unknown as Route.ActionArgs)

async function refusal(promise: Promise<unknown>) {
	const thrown = await promise.then(
		(value) => value,
		(error: unknown) => error
	)
	expect(thrown).toBeInstanceOf(Response)
	const response = thrown as Response
	return { response, body: apiFailureSchema.parse(await response.json()) }
}

/** The attempts `withIdempotency` would have undone. */
let undone: unknown[]

/** Runs a mutation the way `withIdempotency` does, minus the key table. */
async function runMutation(
	mutation: StagedMutation<unknown> | ((t: unknown) => Promise<Response>)
) {
	if (typeof mutation === 'function') return mutation(tx)
	const attempt = { claimId: 'claim-1' }
	const prepared = await mutation.prepare(attempt)
	const response =
		prepared instanceof Response
			? prepared
			: await mutation.run(tx as never, prepared)
	if (!response.ok) {
		await mutation.undo(attempt)
		undone.push(attempt)
	}
	return response
}

beforeEach(() => {
	for (const fn of Object.values(mocks)) fn.mockReset()
	mocks.authorizeAgentRequest.mockResolvedValue(actor)
	mocks.resolveSceneMembership.mockResolvedValue({
		organizationId: 'org-1',
		projectId: PROJECT,
		role: 'member',
		isResourceOwner: false
	})
	mocks.requirePublishEntitlement.mockResolvedValue({
		granted: true,
		effectivePlan: 'pro'
	})
	mocks.assertPublishLimits.mockResolvedValue(undefined)
	mocks.storePublishedGlb.mockResolvedValue({ assetId: 'asset-glb' })
	mocks.publishSceneWithin.mockResolvedValue({
		record: { publishedAt },
		previousAssetId: 'asset-old'
	})
	mocks.revokeScenePublicationWithin.mockResolvedValue('asset-live')
	mocks.collectUnreferencedAssets.mockResolvedValue(undefined)
	mocks.recordAgentAudit.mockResolvedValue(undefined)
	mocks.reclaimUploadBatch.mockResolvedValue([])
	undone = []
	mocks.withIdempotency.mockImplementation((_options, mutation) =>
		runMutation(mutation)
	)
})

describe('POST /api/v1/scenes/:sceneId/publication', () => {
	it('stores the GLB, publishes on the transaction, audits it, answers 200 and then collects the GLB it replaced', async () => {
		const request = post()

		const response = await act(request)

		expect(mocks.authorizeAgentRequest).toHaveBeenCalledWith(request, {
			scope: 'scenes:publish'
		})
		expect(mocks.withIdempotency).toHaveBeenCalledWith(
			{
				grantId: 'grant-1',
				request,
				payload: {
					sceneId: SCENE,
					fileSha256: createHash('sha256').update(glbBytes()).digest('hex')
				}
			},
			expect.objectContaining({ prepare: expect.any(Function) })
		)
		expect(mocks.requirePublishEntitlement).toHaveBeenCalledWith('org-1')
		expect(mocks.storePublishedGlb).toHaveBeenCalledWith({
			sceneId: SCENE,
			userId: 'user-1',
			projectId: PROJECT,
			bytes: glbBytes(),
			requestId: 'claim-1'
		})
		expect(mocks.assertPublishLimits).toHaveBeenCalledWith(tx, {
			sceneId: SCENE,
			projectId: PROJECT,
			organizationId: 'org-1',
			effectivePlan: 'pro',
			publishedAssetId: 'asset-glb'
		})
		expect(mocks.publishSceneWithin).toHaveBeenCalledWith(tx, {
			sceneId: SCENE,
			projectId: PROJECT,
			userId: 'user-1',
			publishedAssetId: 'asset-glb'
		})
		expect(mocks.recordAgentAudit).toHaveBeenCalledWith(
			tx,
			actor,
			'scene:publish',
			SCENE
		)
		expect(response.status).toBe(200)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		const body = await response.json()
		expect(apiSuccessSchema(scenePublicationSchema).parse(body).data).toEqual({
			publication: {
				sceneId: SCENE,
				status: 'published',
				publishedAt: publishedAt.toISOString()
			}
		})
		expect(mocks.collectUnreferencedAssets).toHaveBeenCalledWith(['asset-old'])
		expect(
			mocks.collectUnreferencedAssets.mock.invocationCallOrder[0]
		).toBeGreaterThan(mocks.publishSceneWithin.mock.invocationCallOrder[0])
	})

	it('collects nothing for a replay, whose change committed long ago', async () => {
		mocks.withIdempotency.mockResolvedValue(
			Response.json({ success: true, data: {} }, { status: 200 })
		)

		await act(post())

		expect(mocks.collectUnreferencedAssets).not.toHaveBeenCalled()
	})

	it('collects nothing when the publish did not succeed', async () => {
		mocks.withIdempotency.mockImplementation(async (_options, mutation) => {
			await runMutation(mutation)
			return new Response('boom', { status: 503 })
		})

		await act(post())

		expect(mocks.collectUnreferencedAssets).not.toHaveBeenCalled()
	})

	it('reclaims its own upload batch when the attempt is undone', async () => {
		await act(post())
		const mutation: StagedMutation<unknown> =
			mocks.withIdempotency.mock.calls[0][1]

		await mutation.undo({ claimId: 'claim-7' })

		expect(mocks.reclaimUploadBatch).toHaveBeenCalledWith({
			requestId: 'claim-7',
			projectId: PROJECT
		})
	})

	it.each([
		[
			'read-only billing',
			new EntitlementRequiredError({
				entitlementKey: 'scene_publish',
				plan: 'pro',
				billingState: 'unpaid',
				upgradeTo: null,
				message:
					'Publishing is unavailable: payment required to restore access.'
			}),
			402,
			'payment_required'
		],
		[
			'a plan without publishing',
			new EntitlementRequiredError({
				entitlementKey: 'scene_publish',
				plan: 'free',
				billingState: 'none',
				upgradeTo: 'pro',
				message: 'Publishing is not available on your current plan.'
			}),
			403,
			'insufficient_plan'
		]
	])('refuses %s before storing anything', async (_, error, status, code) => {
		mocks.requirePublishEntitlement.mockRejectedValue(error)

		const response = await act(post())

		expect(response.status).toBe(status)
		expect(apiFailureSchema.parse(await response.json()).code).toBe(code)
		expect(mocks.storePublishedGlb).not.toHaveBeenCalled()
		expect(mocks.publishSceneWithin).not.toHaveBeenCalled()
	})

	it('answers a publish limit as a kept 403, publishes nothing and undoes the upload', async () => {
		mocks.assertPublishLimits.mockRejectedValue(
			new QuotaExceededError({
				limitKey: 'scenes_published_concurrent',
				currentValue: 3,
				limit: 3,
				plan: 'free',
				upgradeTo: 'pro',
				message: 'Free plan limit reached.'
			})
		)

		const response = await act(post())

		expect(response.status).toBe(403)
		const body = await response.json()
		expect(body).toMatchObject({
			code: 'quota_exceeded',
			quota: { limitKey: 'scenes_published_concurrent' }
		})
		expect(mocks.publishSceneWithin).not.toHaveBeenCalled()
		expect(mocks.recordAgentAudit).not.toHaveBeenCalled()
		expect(undone).toHaveLength(1)
		expect(mocks.collectUnreferencedAssets).not.toHaveBeenCalled()
	})

	it('lets any other failure propagate', async () => {
		const failure = new Error('storage down')
		mocks.storePublishedGlb.mockRejectedValue(failure)

		await expect(act(post())).rejects.toBe(failure)
	})

	it.each([
		['without a file', null],
		['with the file as text', 'glb'],
		['whose file is not a GLB', new Blob(['{}'])]
	])('refuses a body %s with 400, before taking a key', async (_, file) => {
		const { response, body } = await refusal(act(post(file)))

		expect(response.status).toBe(400)
		expect(body.code).toBe('invalid_request')
		expect(mocks.withIdempotency).not.toHaveBeenCalled()
	})
})

describe('DELETE /api/v1/scenes/:sceneId/publication', () => {
	it('takes the scene offline on the transaction, audits it, answers 200 and then collects the GLB', async () => {
		const request = del()

		const response = await act(request)

		expect(mocks.authorizeAgentRequest).toHaveBeenCalledWith(request, {
			scope: 'scenes:publish'
		})
		expect(mocks.withIdempotency).toHaveBeenCalledWith(
			{ grantId: 'grant-1', request, payload: { sceneId: SCENE } },
			expect.any(Function)
		)
		expect(mocks.revokeScenePublicationWithin).toHaveBeenCalledWith(tx, SCENE)
		expect(mocks.recordAgentAudit).toHaveBeenCalledWith(
			tx,
			actor,
			'scene:unpublish',
			SCENE
		)
		expect(mocks.requirePublishEntitlement).not.toHaveBeenCalled()
		const body = await response.json()
		expect(apiSuccessSchema(scenePublicationSchema).parse(body).data).toEqual({
			publication: { sceneId: SCENE, status: 'draft', publishedAt: null }
		})
		expect(mocks.collectUnreferencedAssets).toHaveBeenCalledWith(['asset-live'])
	})

	it('answers a scene that was never published as a draft and collects nothing', async () => {
		mocks.revokeScenePublicationWithin.mockResolvedValue(null)

		const response = await act(del())

		expect(response.status).toBe(200)
		expect(mocks.collectUnreferencedAssets).not.toHaveBeenCalled()
	})

	it('collects nothing for a replay', async () => {
		mocks.withIdempotency.mockResolvedValue(
			Response.json({ success: true, data: {} }, { status: 200 })
		)

		await act(del())

		expect(mocks.collectUnreferencedAssets).not.toHaveBeenCalled()
	})
})

describe('/api/v1/scenes/:sceneId/publication, either method', () => {
	it.each([
		['PUT', 'PUT'],
		['PATCH', 'PATCH']
	])('answers %s with 405, before the gate', async (_, method) => {
		const response = await act(new Request(url, { method }))

		expect(response.status).toBe(405)
		expect(response.headers.get('Allow')).toBe('POST, DELETE')
		expect(mocks.authorizeAgentRequest).not.toHaveBeenCalled()
	})

	it('answers a GET with 405 behind the gate', async () => {
		const request = new Request(url)

		const response = await loader({ request } as Route.LoaderArgs)

		expect(response.status).toBe(405)
		expect(mocks.authorizeAgentRequest).toHaveBeenCalledWith(request, {
			scope: 'projects:read'
		})
	})

	it.each([post, del])(
		'answers the gate refusal and touches nothing',
		async (make) => {
			const gate = new Response(null, { status: 403 })
			mocks.authorizeAgentRequest.mockRejectedValue(gate)

			await expect(act(make())).rejects.toBe(gate)
			expect(mocks.resolveSceneMembership).not.toHaveBeenCalled()
			expect(mocks.withIdempotency).not.toHaveBeenCalled()
		}
	)

	it.each([
		['the user cannot see', null, SCENE],
		[
			"is in another organization than the grant's",
			{ organizationId: 'org-2', projectId: PROJECT, role: 'owner' },
			SCENE
		]
	])('answers 404 for a scene %s', async (_, membership, sceneId) => {
		mocks.resolveSceneMembership.mockResolvedValue(membership)

		const { response, body } = await refusal(act(post(), sceneId))

		expect(response.status).toBe(404)
		expect(body.code).toBe('not_found')
		expect(mocks.withIdempotency).not.toHaveBeenCalled()
	})

	it('answers 404 for a scene id that is not a uuid, without a query', async () => {
		const { response } = await refusal(act(del(), 'not-a-uuid'))

		expect(response.status).toBe(404)
		expect(mocks.resolveSceneMembership).not.toHaveBeenCalled()
	})

	it.each([
		['publish', post],
		['unpublish', del]
	])("refuses to %s with 403 when the user's role may not", async (_, make) => {
		mocks.resolveSceneMembership.mockResolvedValue({
			organizationId: 'org-1',
			projectId: PROJECT,
			role: 'guest'
		})

		const { response, body } = await refusal(act(make()))

		expect(response.status).toBe(403)
		expect(body.code).toBe('insufficient_role')
		expect(mocks.withIdempotency).not.toHaveBeenCalled()
	})
})
