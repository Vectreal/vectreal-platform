import {
	apiFailureSchema,
	apiSuccessSchema,
	createdProjectSchema,
	projectListSchema
} from '@vctrl/sdk'
import { RouterContextProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { action, loader } from './projects'
import { agentActorContext } from '../../../lib/domain/agent/agent-actor-context'
import { QuotaExceededError } from '../../../lib/domain/billing/quota-exceeded-error'

import type { Route } from './+types/projects'

const {
	listOrganizationProjects,
	createProject,
	recordAgentAudit,
	withIdempotency
} = vi.hoisted(() => ({
	listOrganizationProjects: vi.fn(),
	createProject: vi.fn(),
	recordAgentAudit: vi.fn(),
	withIdempotency: vi.fn()
}))

// The gate is held to every route by tests/agent-api-routes.spec.ts; a
// handler here runs on the actor the gate would have put in context.
vi.mock('../../../lib/domain/agent/agent-request.server', () => ({
	agentGate: vi.fn()
}))

const contextFor = (actor: unknown) =>
	new RouterContextProvider(new Map([[agentActorContext, actor]]))
vi.mock('../../../lib/domain/project/project-repository.server', () => ({
	listOrganizationProjects,
	createProject
}))
vi.mock('../../../lib/domain/agent/agent-audit.server', () => ({
	recordAgentAudit
}))
vi.mock('../../../lib/domain/agent/agent-idempotency.server', () => ({
	withIdempotency
}))

const request = new Request('https://vectreal.com/api/v1/projects')

const reader = { organizationId: 'org-from-grant', scopes: ['projects:read'] }

beforeEach(() => {
	listOrganizationProjects
		.mockReset()
		.mockResolvedValue([{ id: 'project-1', name: 'Chairs' }])
})

describe('GET /api/v1/projects', () => {
	it("lists the grant's organization in the shape the SDK reads, without caching", async () => {
		const response = await loader({
			request,
			context: contextFor(reader)
		} as unknown as Route.LoaderArgs)

		expect(listOrganizationProjects).toHaveBeenCalledWith('org-from-grant')
		expect(response.status).toBe(200)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		const body = await response.json()
		expect(apiSuccessSchema(projectListSchema).parse(body)).toEqual(body)
		expect(body.data).toEqual({
			projects: [{ id: 'project-1', name: 'Chairs' }]
		})
	})
})

describe('POST /api/v1/projects', () => {
	const actor = {
		grantId: 'grant-1',
		userId: 'user-1',
		organizationId: 'org-from-grant',
		role: 'member',
		scopes: ['projects:read', 'projects:write']
	}

	const post = (body: unknown) =>
		new Request('https://vectreal.com/api/v1/projects', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: typeof body === 'string' ? body : JSON.stringify(body)
		})

	const tx = { transaction: 'tx' }

	let actingAs: unknown = actor

	const act = (request: Request) =>
		action({
			request,
			context: contextFor(actingAs)
		} as unknown as Route.ActionArgs)

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
		actingAs = actor
		createProject
			.mockReset()
			.mockResolvedValue({ id: 'project-9', name: 'Chairs', slug: 'x' })
		recordAgentAudit.mockReset().mockResolvedValue(undefined)
		withIdempotency
			.mockReset()
			.mockImplementation((_options, run: (tx: unknown) => Promise<Response>) =>
				run(tx)
			)
	})

	it("creates the project in the grant's organization, audits it, and answers 201", async () => {
		const request = post({ name: '  Chairs ' })

		const response = await act(request)

		expect(withIdempotency).toHaveBeenCalledWith(
			{ grantId: 'grant-1', request, payload: { name: 'Chairs' } },
			expect.any(Function)
		)
		expect(createProject).toHaveBeenCalledWith(
			'org-from-grant',
			'Chairs',
			'user-1',
			tx
		)
		expect(recordAgentAudit).toHaveBeenCalledWith(
			tx,
			actor,
			'project:create',
			'project-9'
		)
		expect(response.status).toBe(201)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		const body = await response.json()
		expect(apiSuccessSchema(createdProjectSchema).parse(body).data).toEqual({
			project: { id: 'project-9', name: 'Chairs' }
		})
	})

	it("refuses with 403 when the user's role may not create, whatever the scope", async () => {
		// Every role may create today; a role outside the table stands in for
		// the first one that may not, to hold the check in place.
		actingAs = { ...actor, role: 'guest' }

		const { response, body } = await refusal(act(post({ name: 'Chairs' })))

		expect(response.status).toBe(403)
		expect(body.code).toBe('insufficient_role')
		expect(createProject).not.toHaveBeenCalled()
	})

	it.each([
		['not JSON', '{name'],
		['without a name', {}],
		['with a name under 3 characters', { name: ' ab ' }],
		['with a name over 100 characters', { name: 'x'.repeat(101) }]
	])(
		'refuses a body %s with 400, before taking a key',
		async (_label, body) => {
			const { response, body: failure } = await refusal(act(post(body)))

			expect(response.status).toBe(400)
			expect(failure.code).toBe('invalid_request')
			expect(withIdempotency).not.toHaveBeenCalled()
			expect(createProject).not.toHaveBeenCalled()
		}
	)

	it('answers a plan limit with 403, the quota and where to upgrade', async () => {
		createProject.mockRejectedValue(
			new QuotaExceededError({
				limitKey: 'projects_total',
				currentValue: 1,
				limit: 1,
				plan: 'free',
				upgradeTo: 'pro',
				message: 'Project limit reached for your plan (1).'
			})
		)

		const response = await act(post({ name: 'Chairs' }))

		expect(response.status).toBe(403)
		const body = await response.json()
		expect(apiFailureSchema.parse(body).code).toBe('quota_exceeded')
		expect(body.quota).toEqual({
			limitKey: 'projects_total',
			currentValue: 1,
			limit: 1,
			plan: 'free',
			upgradeTo: 'pro'
		})
		expect(body.upgradeUrl).toBe(
			'https://vectreal.com/dashboard/billing/upgrade'
		)
		expect(recordAgentAudit).not.toHaveBeenCalled()
	})

	it('lets any other failure propagate out of the idempotent run', async () => {
		const failure = new Error('database down')
		createProject.mockRejectedValue(failure)

		await expect(act(post({ name: 'Chairs' }))).rejects.toBe(failure)
	})
})
