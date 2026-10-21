import {
	apiFailureSchema,
	apiSuccessSchema,
	sceneEmbedSchema
} from '@vctrl/sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { action, loader } from './scenes.$sceneId.embed'

import type { Route } from './+types/scenes.$sceneId.embed'

const mocks = vi.hoisted(() => ({
	authorizeAgentRequest: vi.fn(),
	resolveSceneMembership: vi.fn(),
	getAllUserApiKeys: vi.fn(),
	resolveApiKeyValue: vi.fn(),
	getProject: vi.fn(),
	isScenePublished: vi.fn()
}))

vi.mock('../../../lib/domain/agent/agent-request.server', () => ({
	authorizeAgentRequest: mocks.authorizeAgentRequest
}))
vi.mock('../../../lib/domain/dashboard/dashboard-permissions.server', () => ({
	resolveSceneMembership: mocks.resolveSceneMembership
}))
vi.mock('../../../lib/domain/auth/api-key-repository.server', () => ({
	getAllUserApiKeys: mocks.getAllUserApiKeys
}))
vi.mock('../../../lib/domain/auth/api-key-value.server', () => ({
	resolveApiKeyValue: mocks.resolveApiKeyValue
}))
vi.mock('../../../lib/domain/project/project-repository.server', () => ({
	getProject: mocks.getProject
}))
vi.mock(
	'../../../lib/domain/scene/server/scene-settings-service.server',
	() => ({
		sceneSettingsService: { isScenePublished: mocks.isScenePublished }
	})
)

const SCENE = '3f2b6c1e-8a4d-4e7b-9c1a-2d5e6f7a8b9c'
const PROJECT = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const KEY_LIVE = '9b2f4c1a-0e3d-4a5b-8c7d-6e5f4a3b2c1d'
const KEY_DEAD = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const ORIGIN = 'https://staging.vectreal.com'
const actor = {
	grantId: 'grant-1',
	userId: 'user-1',
	organizationId: 'org-1',
	role: 'admin',
	scopes: ['projects:read', 'embed:manage']
}

function keyRow(id: string, revokedAt: Date | null = null) {
	return {
		apiKey: {
			id,
			name: `Key ${id}`,
			keyPreview: 'abcd',
			active: true,
			expiresAt: null,
			revokedAt,
			lastUsedAt: null,
			createdAt: new Date('2026-10-01T00:00:00.000Z'),
			kind: 'embed',
			encryptedKey: revokedAt ? null : `cipher-${id}`
		},
		projects: [{ id: PROJECT, name: 'P' }]
	}
}

const load = (query = '', sceneId = SCENE) =>
	loader({
		// A Host the caller chose, which must never reach the URL.
		request: new Request(
			`https://attacker.example/api/v1/scenes/${sceneId}/embed${query}`
		),
		params: { sceneId }
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

beforeEach(() => {
	for (const fn of Object.values(mocks)) fn.mockReset()
	vi.stubEnv('APPLICATION_URL', ORIGIN)
	mocks.authorizeAgentRequest.mockResolvedValue(actor)
	mocks.resolveSceneMembership.mockResolvedValue({
		organizationId: 'org-1',
		projectId: PROJECT,
		role: 'admin',
		isResourceOwner: false
	})
	mocks.isScenePublished.mockResolvedValue(true)
	mocks.getProject.mockResolvedValue({
		id: PROJECT,
		allowedEmbedDomains: 'example.com'
	})
	mocks.getAllUserApiKeys.mockResolvedValue([
		keyRow(KEY_DEAD, new Date('2026-10-02T00:00:00.000Z')),
		keyRow(KEY_LIVE)
	])
	mocks.resolveApiKeyValue.mockImplementation(
		(row: { id: string; revokedAt: Date | null }) =>
			row.revokedAt
				? { readable: false, reason: 'revoked' }
				: { readable: true, value: `token-${row.id}` }
	)
})

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('GET /api/v1/scenes/:sceneId/embed', () => {
	it("answers with the best usable key's URL and snippets, on the deployment's origin", async () => {
		const response = await load()

		expect(mocks.authorizeAgentRequest).toHaveBeenCalledWith(
			expect.any(Request),
			{ scope: 'embed:manage' }
		)
		expect(response.status).toBe(200)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		const { embed } = apiSuccessSchema(sceneEmbedSchema).parse(
			await response.json()
		).data

		const expectedUrl = `${ORIGIN}/embed/${PROJECT}/${SCENE}?token=token-${KEY_LIVE}`
		expect(embed).toMatchObject({
			projectId: PROJECT,
			keyId: KEY_LIVE,
			url: expectedUrl,
			previewUrl: `${ORIGIN}/preview/${PROJECT}/${SCENE}`,
			allowedDomains: ['example.com']
		})
		expect(embed.iframeSnippet).toContain(`src="${expectedUrl}"`)
		expect(embed.sdkSnippet).toContain(`src="${expectedUrl}"`)
		expect(JSON.stringify(embed)).not.toContain('attacker.example')
	})

	it('uses the key the agent names', async () => {
		mocks.getAllUserApiKeys.mockResolvedValue([
			keyRow(KEY_LIVE),
			keyRow(KEY_DEAD)
		])

		const response = await load(`?keyId=${KEY_DEAD}`)

		const { embed } = apiSuccessSchema(sceneEmbedSchema).parse(
			await response.json()
		).data
		expect(embed.keyId).toBe(KEY_DEAD)
		expect(embed.url).toContain(`token=token-${KEY_DEAD}`)
	})

	it('answers 409 scene_not_published for a draft, before reading any key', async () => {
		mocks.isScenePublished.mockResolvedValue(false)

		const { response, body } = await refusal(load())

		expect(mocks.isScenePublished).toHaveBeenCalledWith(SCENE)
		expect(response.status).toBe(409)
		expect(body.code).toBe('scene_not_published')
		expect(mocks.getAllUserApiKeys).not.toHaveBeenCalled()
	})

	it('answers 409 embed_key_required when no key works', async () => {
		mocks.getAllUserApiKeys.mockResolvedValue([
			keyRow(KEY_DEAD, new Date('2026-10-02T00:00:00.000Z'))
		])

		const { response, body } = await refusal(load())

		expect(response.status).toBe(409)
		expect(body.code).toBe('embed_key_required')
		expect(body.error).toContain(`/api/v1/projects/${PROJECT}/embed-keys`)
		// Named so a client can create the key without knowing the scene's project.
		expect(body.projectId).toBe(PROJECT)
	})

	it('answers 409 embed_key_unusable for a named key that is revoked', async () => {
		const { response, body } = await refusal(load(`?keyId=${KEY_DEAD}`))

		expect(response.status).toBe(409)
		expect(body.code).toBe('embed_key_unusable')
	})

	it('answers 409 embed_key_unusable for a named key that has expired', async () => {
		const expired = keyRow(KEY_DEAD)
		expired.apiKey.expiresAt = new Date('2026-10-02T00:00:00.000Z') as never
		mocks.getAllUserApiKeys.mockResolvedValue([keyRow(KEY_LIVE), expired])

		const { response, body } = await refusal(load(`?keyId=${KEY_DEAD}`))

		expect(response.status).toBe(409)
		expect(body.code).toBe('embed_key_unusable')
	})

	it.each([
		['a malformed key id', '?keyId=nope'],
		[
			"a key not linked to the scene's project",
			'?keyId=0f8fad5b-d9cb-469f-a165-70867728950e'
		]
	])('answers 404 for %s', async (_, query) => {
		const { response, body } = await refusal(load(query))

		expect(response.status).toBe(404)
		expect(body.code).toBe('not_found')
	})
})

describe('the scene and the role', () => {
	const member = {
		organizationId: 'org-1',
		projectId: PROJECT,
		role: 'member',
		isResourceOwner: false
	}

	it.each([
		['a malformed id', 'not-a-uuid', undefined],
		['a scene the user cannot see', SCENE, null],
		[
			'a scene in another organization',
			SCENE,
			{ ...member, role: 'admin', organizationId: 'org-2' }
		]
	])('answers 404 for %s', async (_, sceneId, membership) => {
		mocks.resolveSceneMembership.mockResolvedValue(membership)

		const { response } = await refusal(load('', sceneId))

		expect(response.status).toBe(404)
		expect(mocks.getAllUserApiKeys).not.toHaveBeenCalled()
		if (sceneId === 'not-a-uuid') {
			expect(mocks.resolveSceneMembership).not.toHaveBeenCalled()
		}
	})

	it('answers 403 to a member, who may not read keys', async () => {
		mocks.resolveSceneMembership.mockResolvedValue(member)

		const { response, body } = await refusal(load())

		expect(response.status).toBe(403)
		expect(body.code).toBe('insufficient_role')
		expect(mocks.getAllUserApiKeys).not.toHaveBeenCalled()
	})

	it('answers 405 to anything but GET, after the gate', async () => {
		const request = new Request(`${ORIGIN}/api/v1/scenes/${SCENE}/embed`, {
			method: 'POST'
		})

		const response = await action({
			request,
			params: { sceneId: SCENE }
		} as unknown as Route.ActionArgs)

		expect(mocks.authorizeAgentRequest).toHaveBeenCalledWith(request, {
			scope: 'embed:manage'
		})
		expect(response.status).toBe(405)
		expect(response.headers.get('Allow')).toBe('GET')
	})
})
