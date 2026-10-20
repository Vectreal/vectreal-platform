import {
	allowedDomainsSchema,
	apiFailureSchema,
	apiSuccessSchema
} from '@vctrl/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { action, loader } from './projects.$projectId.allowed-domains'

import type { Route } from './+types/projects.$projectId.allowed-domains'

const mocks = vi.hoisted(() => ({
	authorizeAgentRequest: vi.fn(),
	recordAgentAudit: vi.fn(),
	withIdempotency: vi.fn(),
	resolveProjectMembership: vi.fn(),
	getProject: vi.fn(),
	updateProject: vi.fn()
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
vi.mock('../../../lib/domain/project/project-repository.server', () => ({
	getProject: mocks.getProject,
	updateProject: mocks.updateProject
}))

const PROJECT = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const url = `https://vectreal.com/api/v1/projects/${PROJECT}/allowed-domains`
const actor = {
	grantId: 'grant-1',
	userId: 'user-1',
	organizationId: 'org-1',
	role: 'admin',
	scopes: ['projects:read', 'embed:manage']
}
const tx = { transaction: 'tx' }

const put = (body: unknown) =>
	new Request(url, {
		method: 'PUT',
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

async function domainsOf(response: Response) {
	return apiSuccessSchema(allowedDomainsSchema).parse(await response.json())
		.data.allowedDomains
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
	mocks.updateProject.mockResolvedValue({})
	mocks.recordAgentAudit.mockResolvedValue(undefined)
})

describe('PUT /api/v1/projects/:projectId/allowed-domains', () => {
	it('stores the normalized list on the transaction, audits it and answers with it', async () => {
		const request = put({
			domains: ['Example.com', '*.myshopify.com', 'example.com']
		})

		const response = (await act(request)) as Response

		expect(mocks.authorizeAgentRequest).toHaveBeenCalledWith(request, {
			scope: 'embed:manage'
		})
		expect(mocks.withIdempotency).toHaveBeenCalledWith(
			{
				grantId: 'grant-1',
				request,
				payload: {
					projectId: PROJECT,
					patterns: ['example.com', '*.myshopify.com']
				}
			},
			expect.any(Function)
		)
		expect(mocks.updateProject).toHaveBeenCalledWith(
			PROJECT,
			{ allowedEmbedDomains: 'example.com\n*.myshopify.com' },
			'user-1',
			tx
		)
		expect(mocks.recordAgentAudit).toHaveBeenCalledWith(
			tx,
			actor,
			'project-embed-domains:update',
			PROJECT
		)
		expect(response.status).toBe(200)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		expect(await domainsOf(response)).toEqual([
			'example.com',
			'*.myshopify.com'
		])
	})

	it('stores null for an empty list', async () => {
		const response = (await act(put({ domains: [] }))) as Response

		expect(mocks.updateProject).toHaveBeenCalledWith(
			PROJECT,
			{ allowedEmbedDomains: null },
			'user-1',
			tx
		)
		expect(await domainsOf(response)).toEqual([])
	})

	it("refuses a pattern the dashboard would refuse, with the dashboard's message", async () => {
		const { response, body } = await refusal(
			act(put({ domains: ['example.com', 'shop.*.com'] }))
		)

		expect(response.status).toBe(400)
		expect(body.code).toBe('invalid_request')
		expect(body.error).toMatch(/exact hosts or leading wildcard hosts/)
		expect(mocks.withIdempotency).not.toHaveBeenCalled()
	})

	it.each([
		['no body', 'not json'],
		['no domains', {}],
		['domains that are not strings', { domains: [1] }]
	])('refuses %s with 400', async (_, body) => {
		const { response } = await refusal(act(put(body)))

		expect(response.status).toBe(400)
		expect(mocks.withIdempotency).not.toHaveBeenCalled()
	})

	it('answers 405 to any other method, after the gate', async () => {
		const request = new Request(url, { method: 'POST' })

		const response = (await act(request)) as Response

		expect(mocks.authorizeAgentRequest).toHaveBeenCalledWith(request, {
			scope: 'embed:manage'
		})
		expect(response.status).toBe(405)
		expect(response.headers.get('Allow')).toBe('GET, PUT')
	})
})

describe('GET /api/v1/projects/:projectId/allowed-domains', () => {
	it('answers with the stored list', async () => {
		mocks.getProject.mockResolvedValue({
			allowedEmbedDomains: 'example.com\n*.myshopify.com'
		})

		const response = await load()

		expect(mocks.getProject).toHaveBeenCalledWith(PROJECT, 'user-1')
		expect(await domainsOf(response)).toEqual([
			'example.com',
			'*.myshopify.com'
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

		for (const call of [
			act(put({ domains: [] }), projectId),
			load(projectId)
		]) {
			const { response } = await refusal(call)
			expect(response.status).toBe(404)
		}
		expect(mocks.updateProject).not.toHaveBeenCalled()
	})

	it('answers 403 to a member', async () => {
		mocks.resolveProjectMembership.mockResolvedValue(member)

		for (const call of [act(put({ domains: [] })), load()]) {
			const { response, body } = await refusal(call)
			expect(response.status).toBe(403)
			expect(body.code).toBe('insufficient_role')
		}
		expect(mocks.updateProject).not.toHaveBeenCalled()
	})
})
