import {
	apiFailureSchema,
	apiSuccessSchema,
	createdEmbedKeySchema,
	embedKeyListSchema
} from '@vctrl/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { action, loader } from './projects.$projectId.embed-keys'
import { QuotaExceededError } from '../../../lib/domain/billing/quota-exceeded-error'

import type { Route } from './+types/projects.$projectId.embed-keys'

const mocks = vi.hoisted(() => ({
	authorizeAgentRequest: vi.fn(),
	recordAgentAudit: vi.fn(),
	withIdempotency: vi.fn(),
	resolveProjectMembership: vi.fn(),
	createApiKey: vi.fn(),
	getAllUserApiKeys: vi.fn(),
	resolveApiKeyValue: vi.fn()
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
	resolveProjectMembership: mocks.resolveProjectMembership
}))
vi.mock('../../../lib/domain/auth/api-key-repository.server', () => ({
	createApiKey: mocks.createApiKey,
	getAllUserApiKeys: mocks.getAllUserApiKeys
}))
vi.mock('../../../lib/domain/auth/api-key-value.server', () => ({
	resolveApiKeyValue: mocks.resolveApiKeyValue
}))

const PROJECT = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const url = `https://vectreal.com/api/v1/projects/${PROJECT}/embed-keys`
const actor = {
	grantId: 'grant-1',
	userId: 'user-1',
	organizationId: 'org-1',
	role: 'admin',
	scopes: ['projects:read', 'embed:manage']
}
const tx = { transaction: 'tx' }
const TOKEN = 'vctrl_secret_token_value'

function keyRow(
	id: string,
	overrides: Partial<{
		revokedAt: Date | null
		expiresAt: Date | null
		createdAt: Date
	}> = {},
	projectIds = [PROJECT]
) {
	return {
		apiKey: {
			id,
			name: `Key ${id}`,
			keyPreview: 'abcd',
			active: true,
			expiresAt: null,
			revokedAt: null,
			lastUsedAt: null,
			createdAt: new Date('2026-10-01T00:00:00.000Z'),
			kind: 'embed',
			encryptedKey: 'cipher',
			...overrides
		},
		projects: projectIds.map((projectId) => ({ id: projectId, name: 'P' }))
	}
}

const post = (body: unknown = { name: 'Shop page' }) =>
	new Request(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	})
const act = (request: Request, projectId = PROJECT) =>
	action({ request, params: { projectId } } as unknown as Route.ActionArgs)
const load = (projectId = PROJECT) =>
	loader({
		request: new Request(url),
		params: { projectId }
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
	mocks.authorizeAgentRequest.mockResolvedValue(actor)
	mocks.resolveProjectMembership.mockResolvedValue({
		organizationId: 'org-1',
		projectId: PROJECT,
		role: 'admin',
		isResourceOwner: false
	})
	mocks.withIdempotency.mockImplementation(
		(_options, mutation: (t: unknown) => Promise<Response>) => mutation(tx)
	)
	mocks.createApiKey.mockImplementation(async () => ({
		...keyRow('key-new'),
		plaintext: TOKEN
	}))
	mocks.resolveApiKeyValue.mockReturnValue({ readable: true, value: TOKEN })
	mocks.recordAgentAudit.mockResolvedValue(undefined)
})

describe('POST /api/v1/projects/:projectId/embed-keys', () => {
	it('creates the key on the transaction, audits it and answers 201 without the token', async () => {
		const request = post()

		const response = await act(request)

		expect(mocks.authorizeAgentRequest).toHaveBeenCalledWith(request, {
			scope: 'embed:manage'
		})
		expect(mocks.withIdempotency).toHaveBeenCalledWith(
			{
				grantId: 'grant-1',
				request,
				payload: { projectId: PROJECT, name: 'Shop page' }
			},
			expect.any(Function)
		)
		expect(mocks.createApiKey).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				organizationId: 'org-1',
				name: 'Shop page',
				projectIds: [PROJECT],
				expiresAt: expect.any(Date)
			}),
			tx
		)
		const expiresAt: Date = mocks.createApiKey.mock.calls[0][0].expiresAt
		const days = (expiresAt.getTime() - Date.now()) / 86_400_000
		expect(Math.round(days)).toBe(90)
		expect(mocks.recordAgentAudit).toHaveBeenCalledWith(
			tx,
			actor,
			'api-key:create',
			'key-new'
		)

		expect(response.status).toBe(201)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		const text = await response.text()
		// The kept response is stored as sent, so the token must not be in it.
		expect(text).not.toContain(TOKEN)
		const body = apiSuccessSchema(createdEmbedKeySchema).parse(JSON.parse(text))
		expect(body.data.embedKey).toEqual({
			id: 'key-new',
			name: 'Key key-new',
			keyPreview: 'abcd',
			expiresAt: null,
			lastUsedAt: null,
			revoked: false,
			expired: false,
			usable: true
		})
		expect(body.data.embedKey).not.toHaveProperty('value')
	})

	it('keeps a plan limit as a 403 with the quota', async () => {
		mocks.createApiKey.mockRejectedValue(
			new QuotaExceededError({
				limitKey: 'api_keys_per_org',
				currentValue: 2,
				limit: 2,
				plan: 'free',
				upgradeTo: 'pro',
				message: 'API key limit reached for your plan (2).'
			})
		)

		const response = (await act(post())) as Response

		expect(response.status).toBe(403)
		const body = apiFailureSchema.parse(await response.json())
		expect(body).toMatchObject({
			code: 'quota_exceeded',
			error: 'API key limit reached for your plan (2).'
		})
		expect(mocks.recordAgentAudit).not.toHaveBeenCalled()
	})

	it.each([
		['no body', 'not json'],
		['no name', {}],
		['an empty name', { name: '  ' }],
		['a name over 100 characters', { name: 'x'.repeat(101) }]
	])('refuses %s with 400 before taking a key', async (_, body) => {
		const { response, body: failure } = await refusal(act(post(body)))

		expect(response.status).toBe(400)
		expect(failure.code).toBe('invalid_request')
		expect(mocks.withIdempotency).not.toHaveBeenCalled()
	})

	it('answers 405 to any other method, after the gate', async () => {
		const request = new Request(url, { method: 'PATCH' })

		const response = (await act(request)) as Response

		expect(mocks.authorizeAgentRequest).toHaveBeenCalledWith(request, {
			scope: 'embed:manage'
		})

		expect(response.status).toBe(405)
		expect(response.headers.get('Allow')).toBe('GET, POST')
	})
})

describe('GET /api/v1/projects/:projectId/embed-keys', () => {
	it("lists this project's keys usable first, without any token", async () => {
		const now = Date.now()
		mocks.getAllUserApiKeys.mockResolvedValue([
			keyRow('key-revoked', { revokedAt: new Date(now - 1000) }),
			keyRow('key-other-project', {}, ['0f8fad5b-d9cb-469f-a165-70867728950e']),
			keyRow('key-live', { createdAt: new Date(now - 1000) }),
			keyRow('key-expired', {
				expiresAt: new Date(now - 1000),
				createdAt: new Date(now - 2000)
			})
		])
		mocks.resolveApiKeyValue.mockImplementation(
			(row: { revokedAt: Date | null }) =>
				row.revokedAt
					? { readable: false, reason: 'revoked' }
					: { readable: true, value: TOKEN }
		)

		const response = await load()

		expect(mocks.authorizeAgentRequest).toHaveBeenCalledWith(
			expect.any(Request),
			{ scope: 'embed:manage' }
		)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		const text = await response.text()
		expect(text).not.toContain(TOKEN)
		const { data } = apiSuccessSchema(embedKeyListSchema).parse(
			JSON.parse(text)
		)
		expect(data.embedKeys.map((key) => [key.id, key.usable])).toEqual([
			['key-live', true],
			['key-expired', false],
			['key-revoked', false]
		])
	})
})

describe('the project and the role', () => {
	const member = {
		organizationId: 'org-1',
		projectId: PROJECT,
		role: 'member',
		isResourceOwner: false
	}

	it.each([
		['a malformed id', 'not-a-uuid', undefined],
		['a project the user cannot see', PROJECT, null],
		[
			'a project in another organization',
			PROJECT,
			{ ...member, role: 'admin', organizationId: 'org-2' }
		]
	])('answers 404 for %s', async (_, projectId, membership) => {
		mocks.resolveProjectMembership.mockResolvedValue(membership)

		for (const call of [act(post(), projectId), load(projectId)]) {
			const { response, body } = await refusal(call)
			expect(response.status).toBe(404)
			expect(body.code).toBe('not_found')
		}
		if (projectId === 'not-a-uuid') {
			expect(mocks.resolveProjectMembership).not.toHaveBeenCalled()
		}
		expect(mocks.createApiKey).not.toHaveBeenCalled()
	})

	it('answers 403 to a member, who may not manage keys', async () => {
		mocks.resolveProjectMembership.mockResolvedValue(member)

		for (const call of [act(post()), load()]) {
			const { response, body } = await refusal(call)
			expect(response.status).toBe(403)
			expect(body.code).toBe('insufficient_role')
		}
		expect(mocks.getAllUserApiKeys).not.toHaveBeenCalled()
		expect(mocks.createApiKey).not.toHaveBeenCalled()
	})
})
