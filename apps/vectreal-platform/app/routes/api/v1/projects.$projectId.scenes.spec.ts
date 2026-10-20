import { createHash } from 'node:crypto'

import {
	apiFailureSchema,
	apiSuccessSchema,
	createdSceneSchema,
	sceneListSchema
} from '@vctrl/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { action, loader } from './projects.$projectId.scenes'
import { MAX_STORED_FILE_BYTES } from '../../../constants/utility-constants'
import { withSceneSettingsDefaults } from '../../../constants/viewer-defaults'
import { EntitlementRequiredError } from '../../../lib/domain/billing/entitlement-required-error'
import { QuotaExceededError } from '../../../lib/domain/billing/quota-exceeded-error'

import type { Route } from './+types/projects.$projectId.scenes'
import type { StagedMutation } from '../../../lib/domain/agent/agent-idempotency.server'

const mocks = vi.hoisted(() => ({
	authorizeAgentRequest: vi.fn(),
	recordAgentAudit: vi.fn(),
	withIdempotency: vi.fn(),
	resolveProjectMembership: vi.fn(),
	prepareSceneUpload: vi.fn(),
	uploadSceneAssets: vi.fn(),
	reclaimUploadBatch: vi.fn(),
	saveSceneSettingsWithin: vi.fn(),
	getProjectsScenes: vi.fn()
}))

vi.mock(
	'../../../lib/domain/scene/server/scene-folder-repository.server',
	() => ({
		getProjectsScenes: mocks.getProjectsScenes
	})
)

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
	resolveProjectMembership: mocks.resolveProjectMembership
}))
vi.mock(
	'../../../lib/domain/scene/server/scene-upload.operations.server',
	() => ({
		prepareSceneUpload: mocks.prepareSceneUpload
	})
)
vi.mock('../../../lib/domain/asset/asset-storage.server', () => ({
	uploadSceneAssets: mocks.uploadSceneAssets
}))
vi.mock('../../../lib/domain/asset/asset-reclaim.server', () => ({
	reclaimUploadBatch: mocks.reclaimUploadBatch
}))
vi.mock(
	'../../../lib/domain/scene/server/scene-settings-service.server',
	() => ({
		sceneSettingsService: {
			saveSceneSettingsWithin: mocks.saveSceneSettingsWithin
		}
	})
)

/** The smallest GLB with a BIN chunk: `{"asset":{"version":"2.0"},"buffers":[{"byteLength":4}]}`. */
function glbBytes(): Uint8Array<ArrayBuffer> {
	const json = new TextEncoder().encode(
		JSON.stringify({ asset: { version: '2.0' }, buffers: [{ byteLength: 4 }] })
	)
	const jsonChunk = new Uint8Array(Math.ceil(json.byteLength / 4) * 4).fill(
		0x20
	)
	jsonChunk.set(json)
	const length = 12 + 8 + jsonChunk.byteLength + 8 + 4
	const out = new Uint8Array(length)
	const view = new DataView(out.buffer)
	view.setUint32(0, 0x46546c67, true)
	view.setUint32(4, 2, true)
	view.setUint32(8, length, true)
	view.setUint32(12, jsonChunk.byteLength, true)
	view.setUint32(16, 0x4e4f534a, true)
	out.set(jsonChunk, 20)
	view.setUint32(20 + jsonChunk.byteLength, 4, true)
	view.setUint32(24 + jsonChunk.byteLength, 0x004e4942, true)
	out.set([9, 8, 7, 6], 28 + jsonChunk.byteLength)
	return out
}

const PROJECT = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

const actor = {
	grantId: 'grant-1',
	userId: 'user-1',
	organizationId: 'org-1',
	role: 'member',
	scopes: ['projects:read', 'projects:write']
}
const tx = { transaction: 'tx' }
const url = `https://vectreal.com/api/v1/projects/${PROJECT}/scenes`

function post(
	fields: { name?: string; file?: Blob | string } = {
		name: ' Chair ',
		file: new Blob([glbBytes()])
	},
	init: RequestInit = {}
) {
	const form = new FormData()
	if (fields.name !== undefined) form.set('name', fields.name)
	if (fields.file !== undefined) form.set('file', fields.file)
	return new Request(url, { method: 'POST', body: form, ...init })
}

const act = (request: Request, projectId = PROJECT) =>
	action({ request, params: { projectId } } as unknown as Route.ActionArgs)

async function refusal(promise: Promise<unknown>) {
	const thrown = await promise.then(
		(value) => value,
		(error: unknown) => error
	)
	expect(thrown).toBeInstanceOf(Response)
	const response = thrown as Response
	return { response, body: apiFailureSchema.parse(await response.json()) }
}

/** What the staged mutation did, as `withIdempotency` would run it. */
let undone: unknown[]

beforeEach(() => {
	for (const fn of Object.values(mocks)) fn.mockReset()
	mocks.authorizeAgentRequest.mockResolvedValue(actor)
	mocks.resolveProjectMembership.mockResolvedValue({
		organizationId: 'org-1',
		projectId: PROJECT,
		role: 'member',
		isResourceOwner: false
	})
	mocks.prepareSceneUpload.mockResolvedValue({
		sceneId: 'scene-9',
		projectId: PROJECT,
		existingAssets: {}
	})
	mocks.uploadSceneAssets.mockResolvedValue([
		{ assetId: 'asset-gltf' },
		{ assetId: 'asset-bin' }
	])
	mocks.saveSceneSettingsWithin.mockResolvedValue({
		settings: {},
		removedAssetIds: []
	})
	mocks.recordAgentAudit.mockResolvedValue(undefined)
	mocks.reclaimUploadBatch.mockResolvedValue([])
	undone = []
	mocks.withIdempotency.mockImplementation(
		async (_options, mutation: StagedMutation<unknown>) => {
			const attempt = { claimId: 'claim-1' }
			const prepared = await mutation.prepare(attempt)
			if (prepared instanceof Response) {
				await mutation.undo(attempt)
				undone.push(attempt)
				return prepared
			}
			return mutation.run(tx as never, prepared)
		}
	)
})

describe('GET /api/v1/projects/:projectId/scenes', () => {
	const list = (projectId = PROJECT) =>
		loader({
			request: new Request(url),
			params: { projectId }
		} as unknown as Route.LoaderArgs)

	it('lists the project’s scenes as the user sees them, behind projects:read', async () => {
		const updatedAt = new Date('2026-10-20T08:00:00.000Z')
		mocks.getProjectsScenes.mockResolvedValue(
			new Map([
				[
					PROJECT,
					[
						{
							id: 'scene-1',
							name: 'Chair',
							status: 'published',
							updatedAt,
							folderId: null
						}
					]
				]
			])
		)

		const response = await list()

		expect(mocks.authorizeAgentRequest).toHaveBeenCalledWith(
			expect.any(Request),
			{ scope: 'projects:read' }
		)
		expect(mocks.resolveProjectMembership).toHaveBeenCalledWith(
			PROJECT,
			'user-1'
		)
		expect(mocks.getProjectsScenes).toHaveBeenCalledWith([PROJECT], 'user-1')
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		expect(
			apiSuccessSchema(sceneListSchema).parse(await response.json()).data
		).toEqual({
			scenes: [
				{
					id: 'scene-1',
					name: 'Chair',
					status: 'published',
					updatedAt: updatedAt.toISOString()
				}
			]
		})
	})

	it('answers an empty project with an empty list', async () => {
		mocks.getProjectsScenes.mockResolvedValue(new Map([[PROJECT, []]]))

		const response = await list()

		expect(await response.json()).toMatchObject({ data: { scenes: [] } })
	})

	it('answers 404 for a project in another organization, and lists nothing', async () => {
		mocks.resolveProjectMembership.mockResolvedValue({
			organizationId: 'org-2',
			projectId: PROJECT,
			role: 'owner'
		})

		const { response, body } = await refusal(list())

		expect(response.status).toBe(404)
		expect(body.code).toBe('not_found')
		expect(mocks.getProjectsScenes).not.toHaveBeenCalled()
	})

	it('answers the gate refusal before resolving the project', async () => {
		const gate = new Response(null, { status: 401 })
		mocks.authorizeAgentRequest.mockRejectedValue(gate)

		await expect(list()).rejects.toBe(gate)
		expect(mocks.resolveProjectMembership).not.toHaveBeenCalled()
	})
})

describe('POST /api/v1/projects/:projectId/scenes', () => {
	it('stores the GLB as glTF and bin, saves the scene in the transaction, audits it and answers 201', async () => {
		const request = post()

		const response = await act(request)

		expect(mocks.authorizeAgentRequest).toHaveBeenCalledWith(request, {
			scope: 'projects:write'
		})
		expect(mocks.withIdempotency).toHaveBeenCalledWith(
			{
				grantId: 'grant-1',
				request,
				payload: {
					projectId: PROJECT,
					name: 'Chair',
					fileSha256: createHash('sha256').update(glbBytes()).digest('hex')
				}
			},
			expect.objectContaining({ prepare: expect.any(Function) })
		)
		expect(mocks.prepareSceneUpload).toHaveBeenCalledWith(
			expect.objectContaining({ targetProjectId: PROJECT }),
			'user-1'
		)

		const [sceneId, userId, projectId, files, batch] =
			mocks.uploadSceneAssets.mock.calls[0]
		expect([sceneId, userId, projectId, batch]).toEqual([
			'scene-9',
			'user-1',
			PROJECT,
			'claim-1'
		])
		expect(files.map((file: { fileName: string }) => file.fileName)).toEqual([
			'scene.gltf',
			'scene.bin'
		])
		expect(files[0].mimeType).toBe('model/gltf+json')
		expect(
			JSON.parse(new TextDecoder().decode(files[0].data)).buffers[0].uri
		).toBe('scene.bin')
		expect(files[1].data).toEqual(new Uint8Array([9, 8, 7, 6]))

		expect(mocks.saveSceneSettingsWithin).toHaveBeenCalledWith(tx, {
			sceneId: 'scene-9',
			projectId: PROJECT,
			userId: 'user-1',
			meta: { name: 'Chair', description: '', thumbnailUrl: '' },
			settings: withSceneSettingsDefaults({}),
			sceneAssetIds: ['asset-gltf', 'asset-bin']
		})
		expect(mocks.recordAgentAudit).toHaveBeenCalledWith(
			tx,
			actor,
			'scene:create',
			'scene-9'
		)
		expect(response.status).toBe(201)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		const body = await response.json()
		expect(apiSuccessSchema(createdSceneSchema).parse(body).data).toEqual({
			scene: { id: 'scene-9', projectId: PROJECT, name: 'Chair' }
		})
	})

	it('keys a different file apart from the same name', async () => {
		const other = glbBytes()
		other[other.length - 1] = 0

		await act(post({ name: 'Chair', file: new Blob([other]) }))

		expect(mocks.withIdempotency.mock.calls[0][0].payload.fileSha256).toBe(
			createHash('sha256').update(other).digest('hex')
		)
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

	it('answers a method other than POST with 405, before the gate', async () => {
		const response = await act(new Request(url, { method: 'PUT' }))

		expect(response.status).toBe(405)
		expect(response.headers.get('Allow')).toBe('GET, POST')
		expect(mocks.authorizeAgentRequest).not.toHaveBeenCalled()
	})

	it('answers the gate refusal and stores nothing', async () => {
		const gate = new Response(null, { status: 403 })
		mocks.authorizeAgentRequest.mockRejectedValue(gate)

		await expect(act(post())).rejects.toBe(gate)
		expect(mocks.resolveProjectMembership).not.toHaveBeenCalled()
		expect(mocks.withIdempotency).not.toHaveBeenCalled()
	})

	it.each([
		['the user is not a member of', null],
		[
			"is in another organization than the grant's",
			{ organizationId: 'org-2', projectId: PROJECT, role: 'owner' }
		]
	])('answers 404 for a project %s', async (_, membership) => {
		mocks.resolveProjectMembership.mockResolvedValue(membership)

		const { response, body } = await refusal(act(post()))

		expect(response.status).toBe(404)
		expect(body.code).toBe('not_found')
		expect(mocks.withIdempotency).not.toHaveBeenCalled()
	})

	it('answers 404 for a project id that is not a uuid, without a query', async () => {
		const { response, body } = await refusal(act(post(), 'not-a-uuid'))

		expect(response.status).toBe(404)
		expect(body.code).toBe('not_found')
		expect(mocks.resolveProjectMembership).not.toHaveBeenCalled()
	})

	it("refuses with 403 when the user's role may not create scenes", async () => {
		mocks.resolveProjectMembership.mockResolvedValue({
			organizationId: 'org-1',
			projectId: PROJECT,
			role: 'guest'
		})

		const { response, body } = await refusal(act(post()))

		expect(response.status).toBe(403)
		expect(body.code).toBe('insufficient_role')
		expect(mocks.withIdempotency).not.toHaveBeenCalled()
	})

	it.each([
		['without a file', { name: 'Chair' }],
		['with the file as text', { name: 'Chair', file: 'glb' }],
		['without a name', { file: new Blob([glbBytes()]) }],
		['with a blank name', { name: '   ', file: new Blob([glbBytes()]) }],
		[
			'with a name over 100 characters',
			{ name: 'x'.repeat(101), file: new Blob([glbBytes()]) }
		],
		['whose file is not a GLB', { name: 'Chair', file: new Blob(['{}']) }]
	])('refuses a body %s with 400, before taking a key', async (_, fields) => {
		const { response, body } = await refusal(act(post(fields)))

		expect(response.status).toBe(400)
		expect(body.code).toBe('invalid_request')
		expect(mocks.withIdempotency).not.toHaveBeenCalled()
	})

	it('refuses a file over the size cap with 413, before taking a key', async () => {
		const big = new Blob([glbBytes(), new Uint8Array(MAX_STORED_FILE_BYTES)])

		const { response } = await refusal(act(post({ name: 'Chair', file: big })))

		expect(response.status).toBe(413)
		expect(mocks.withIdempotency).not.toHaveBeenCalled()
	})

	it('refuses a declared body far over the cap without reading it', async () => {
		const request = new Request(url, {
			method: 'POST',
			headers: { 'Content-Length': String(MAX_STORED_FILE_BYTES * 2) },
			body: 'x'
		})
		const formData = vi.spyOn(request, 'formData')

		const { response } = await refusal(act(request))

		expect(response.status).toBe(413)
		expect(formData).not.toHaveBeenCalled()
	})

	it('refuses a body without a length that streams past the cap, before taking a key', async () => {
		const chunk = new Uint8Array(1024 * 1024)
		let sent = 0
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				sent += chunk.byteLength
				controller.enqueue(chunk)
			}
		})
		const request = new Request(url, {
			method: 'POST',
			headers: { 'Content-Type': 'multipart/form-data; boundary=x' },
			body,
			duplex: 'half'
		} as RequestInit)

		const { response } = await refusal(act(request))

		expect(response.status).toBe(413)
		expect(sent).toBeLessThan(MAX_STORED_FILE_BYTES * 1.1)
		expect(mocks.withIdempotency).not.toHaveBeenCalled()
	})

	it.each([
		[
			'a scene limit',
			() => mocks.prepareSceneUpload,
			new QuotaExceededError({
				limitKey: 'scenes_total',
				currentValue: 3,
				limit: 3,
				plan: 'free',
				upgradeTo: 'pro',
				message: 'Scene limit reached for your plan (3).'
			}),
			403,
			'quota_exceeded'
		],
		[
			'a storage limit',
			() => mocks.uploadSceneAssets,
			new QuotaExceededError({
				limitKey: 'storage_bytes_total',
				currentValue: 10,
				limit: 10,
				plan: 'free',
				upgradeTo: 'pro',
				message: 'Storage limit reached.'
			}),
			403,
			'quota_exceeded'
		],
		[
			'read-only billing',
			() => mocks.prepareSceneUpload,
			new EntitlementRequiredError({
				entitlementKey: 'scene_upload',
				plan: 'pro',
				billingState: 'unpaid',
				upgradeTo: null,
				message: 'Uploads are unavailable: payment required to restore access.'
			}),
			402,
			'payment_required'
		],
		[
			'a plan without uploads',
			() => mocks.prepareSceneUpload,
			new EntitlementRequiredError({
				entitlementKey: 'scene_upload',
				plan: 'free',
				billingState: 'none',
				upgradeTo: 'pro',
				message: 'Uploads are not available on your current plan.'
			}),
			403,
			'insufficient_plan'
		]
	])(
		'answers %s as a kept refusal with where to upgrade, and saves nothing',
		async (_, step, error, status, code) => {
			step().mockRejectedValue(error)

			const response = await act(post())

			expect(response.status).toBe(status)
			const body = await response.json()
			expect(apiFailureSchema.parse(body).code).toBe(code)
			expect(body.upgradeUrl).toBe(
				'https://vectreal.com/dashboard/billing/upgrade'
			)
			expect(undone).toHaveLength(1)
			expect(mocks.saveSceneSettingsWithin).not.toHaveBeenCalled()
			expect(mocks.recordAgentAudit).not.toHaveBeenCalled()
		}
	)

	it('lets any other failure in prepare propagate', async () => {
		const failure = new Error('storage down')
		mocks.uploadSceneAssets.mockRejectedValue(failure)

		await expect(act(post())).rejects.toBe(failure)
	})
})
