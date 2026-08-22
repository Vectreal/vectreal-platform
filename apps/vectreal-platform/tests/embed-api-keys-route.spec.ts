/**
 * The route's guards, with the database mocked out.
 *
 * `embed-key-options.spec.ts` proves the shaping rules answer correctly. This
 * one proves the route *asks* them, and asserts the two properties that have no
 * other home: that a non-member is told the project does not exist rather than
 * that they may not see it, and that the rotated session cookie survives every
 * response - including the two `ApiResponse` statics that take no headers.
 *
 * `dashboard-mutations-execution.spec.ts` is the template for the mocking.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const PROJECT_ID = 'project-1'
const ORG_ID = 'org-1'

vi.mock('../app/db/client', () => ({ getDbClient: () => ({}) }))

vi.mock('../app/lib/domain/auth/api-key-repository.server', () => ({
	createApiKey: vi.fn(),
	getAllUserApiKeys: vi.fn(async () => [])
}))

vi.mock('../app/lib/domain/dashboard/dashboard-permissions.server', () => ({
	resolveProjectMembership: vi.fn()
}))

vi.mock('../app/lib/domain/project/project-repository.server', () => ({
	getProject: vi.fn()
}))

vi.mock('../app/lib/http/auth.server', () => ({ getAuthUser: vi.fn() }))

vi.mock('../app/lib/http/csrf.server', () => ({
	ensureValidCsrfFormData: vi.fn(async () => null)
}))

import {
	createApiKey,
	getAllUserApiKeys
} from '../app/lib/domain/auth/api-key-repository.server'
import { QuotaExceededError } from '../app/lib/domain/billing/quota-exceeded-error'
import { resolveProjectMembership } from '../app/lib/domain/dashboard/dashboard-permissions.server'
import { getProject } from '../app/lib/domain/project/project-repository.server'
import { getAuthUser } from '../app/lib/http/auth.server'
import { action, loader } from '../app/routes/api/projects.$projectId.api-keys'

import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'

/** Route handlers take a router context this spec has no use for. */
const routeArgs = (request: Request) =>
	({ request, params: { projectId: PROJECT_ID } }) as unknown as LoaderFunctionArgs &
		ActionFunctionArgs


/** The rotated Supabase cookie every response has to carry back. */
const SESSION_COOKIE = 'sb-access-token=rotated; Path=/'

function authenticateAs(role: 'owner' | 'admin' | 'member' | null) {
	vi.mocked(getAuthUser).mockResolvedValue({
		user: { id: 'user-1' },
		headers: new Headers({ 'Set-Cookie': SESSION_COOKIE })
	} as unknown as Awaited<ReturnType<typeof getAuthUser>>)

	vi.mocked(resolveProjectMembership).mockResolvedValue(
		role
			? {
					organizationId: ORG_ID,
					projectId: PROJECT_ID,
					role,
					isResourceOwner: false
				}
			: null
	)

	vi.mocked(getProject).mockResolvedValue({
		id: PROJECT_ID,
		organizationId: ORG_ID,
		name: 'Storefront',
		slug: 'storefront',
		// Exact hosts only: `parseAllowedDomainPatterns` silently discards every
		// `*.` pattern today (filed separately), and encoding that here would
		// make the eventual fix look like a regression in this spec.
		allowedEmbedDomains: 'shop.example.com\nstore.example.com'
	})
}

const loadKeys = () =>
	loader(
		routeArgs(
			new Request(`https://vectreal.com/api/projects/${PROJECT_ID}/api-keys`)
		)
	)

function createRequest() {
	const body = new FormData()
	body.set('intent', 'create')
	body.set('csrf', 'token')

	return new Request(
		`https://vectreal.com/api/projects/${PROJECT_ID}/api-keys`,
		{ method: 'POST', body }
	)
}

const submitCreate = () => action(routeArgs(createRequest()))

beforeEach(() => {
	vi.clearAllMocks()
	vi.mocked(getAllUserApiKeys).mockResolvedValue([])
})

describe('loader', () => {
	it('serves a member of the project their keys and domains', async () => {
		authenticateAs('admin')
		const response = (await loadKeys()) as Response

		expect(response.status).toBe(200)
		await expect(response.json()).resolves.toMatchObject({
			success: true,
			data: {
				projectId: PROJECT_ID,
				projectName: 'Storefront',
				allowedDomains: ['shop.example.com', 'store.example.com'],
				canCreateKey: true
			}
		})
	})

	it('reports a project the actor cannot see as missing, not forbidden', async () => {
		/*
		  404, not 403. A 403 would confirm the id names a real project, which
		  turns this route into a way to enumerate them.
		*/
		authenticateAs(null)
		const response = (await loadKeys()) as Response

		expect(response.status).toBe(404)
		expect(vi.mocked(getAllUserApiKeys)).not.toHaveBeenCalled()
	})

	it('refuses a member who may open the panel but may not read keys', async () => {
		authenticateAs('member')
		const response = (await loadKeys()) as Response

		expect(response.status).toBe(403)
		expect(vi.mocked(getAllUserApiKeys)).not.toHaveBeenCalled()
	})

	it('drops keys scoped to a different project', async () => {
		authenticateAs('owner')
		vi.mocked(getAllUserApiKeys).mockResolvedValue([
			{
				apiKey: {
					id: 'mine',
					name: 'mine',
					keyPreview: 'ab3x',
					active: true,
					expiresAt: null,
					revokedAt: null,
					lastUsedAt: null,
					createdAt: new Date('2026-01-01')
				},
				projects: [{ id: PROJECT_ID }]
			},
			{
				apiKey: {
					id: 'theirs',
					name: 'theirs',
					keyPreview: '9zQ1',
					active: true,
					expiresAt: null,
					revokedAt: null,
					lastUsedAt: null,
					createdAt: new Date('2026-01-01')
				},
				projects: [{ id: 'project-2' }]
			}
		] as unknown as Awaited<ReturnType<typeof getAllUserApiKeys>>)

		const body = await ((await loadKeys()) as Response).json()

		expect(body.data.keys.map((key: { id: string }) => key.id)).toEqual(['mine'])
	})
})

describe('action', () => {
	it('rejects a method other than POST before reading anything', async () => {
		const response = (await action(
			routeArgs(new Request('https://vectreal.com/x', { method: 'GET' }))
		)) as Response

		expect(response.status).toBe(405)
		expect(vi.mocked(getAuthUser)).not.toHaveBeenCalled()
	})

	it('scopes a created key to this project alone', async () => {
		authenticateAs('admin')
		vi.mocked(createApiKey).mockResolvedValue({
			apiKey: {
				id: 'new-key',
				name: 'Embed key for Storefront',
				keyPreview: 'ab3x',
				active: true,
				expiresAt: new Date('2026-11-20'),
				revokedAt: null,
				lastUsedAt: null,
				createdAt: new Date('2026-08-22')
			},
			plaintext: 'vctrl_secretab3x'
		} as unknown as Awaited<ReturnType<typeof createApiKey>>)

		const response = (await submitCreate()) as Response
		const body = await response.json()

		expect(response.status).toBe(201)
		expect(vi.mocked(createApiKey).mock.calls[0][0]).toMatchObject({
			organizationId: ORG_ID,
			projectIds: [PROJECT_ID]
		})
		expect(body.data.plaintext).toBe('vctrl_secretab3x')
		expect(body.data.key.keyPreview).toBe('ab3x')
	})

	it('refuses a member and never reaches the repository', async () => {
		authenticateAs('member')
		const response = (await submitCreate()) as Response

		expect(response.status).toBe(403)
		expect(vi.mocked(createApiKey)).not.toHaveBeenCalled()
	})

	it('forwards the quota envelope so the panel can offer an upgrade', async () => {
		authenticateAs('owner')
		vi.mocked(createApiKey).mockRejectedValue(
			new QuotaExceededError({
				limitKey: 'api_keys_per_org',
				currentValue: 3,
				limit: 3,
				plan: 'free',
				upgradeTo: 'pro',
				message: 'API key limit reached for your plan.'
			})
		)

		const response = (await submitCreate()) as Response

		expect(response.status).toBe(403)
		await expect(response.json()).resolves.toMatchObject({
			success: false,
			quota: { limitKey: 'api_keys_per_org', plan: 'free', upgradeTo: 'pro' }
		})
	})
})

describe('the rotated session cookie survives every response', () => {
	/*
	  `ApiResponse.badRequest` and `.quotaExceeded` are the only two statics that
	  accept no headers, so both need the local `withHeaders` wrapper. Dropping it
	  loses a rotated Supabase cookie and silently desynchronizes the session -
	  a failure with no symptom at the point it happens.
	*/
	it.each([
		['success', 'admin' as const, 'ok' as const],
		['quota refusal', 'owner' as const, 'quota' as const],
		['repository failure', 'owner' as const, 'error' as const],
		['unsupported intent', 'admin' as const, 'intent' as const]
	])('carries it on a %s', async (_label, role, outcome) => {
		authenticateAs(role)

		if (outcome === 'quota') {
			vi.mocked(createApiKey).mockRejectedValue(
				new QuotaExceededError({
					limitKey: 'api_keys_per_org',
					currentValue: 3,
					limit: 3,
					plan: 'free',
					upgradeTo: 'pro',
					message: 'limit'
				})
			)
		} else if (outcome === 'error') {
			vi.mocked(createApiKey).mockRejectedValue(new Error('database is down'))
		} else {
			vi.mocked(createApiKey).mockResolvedValue({
				apiKey: {
					id: 'k',
					name: 'k',
					keyPreview: 'ab3x',
					active: true,
					expiresAt: null,
					revokedAt: null,
					lastUsedAt: null,
					createdAt: new Date('2026-08-22')
				},
				plaintext: 'vctrl_x'
			} as unknown as Awaited<ReturnType<typeof createApiKey>>)
		}

		const body = new FormData()
		body.set('intent', outcome === 'intent' ? 'destroy' : 'create')
		body.set('csrf', 'token')

		const response = (await action(
			routeArgs(
				new Request(
					`https://vectreal.com/api/projects/${PROJECT_ID}/api-keys`,
					{ method: 'POST', body }
				)
			)
		)) as Response

		expect(response.headers.get('Set-Cookie')).toBe(SESSION_COOKIE)
	})

	it('carries it on the loader too', async () => {
		authenticateAs('admin')
		const response = (await loadKeys()) as Response

		expect(response.headers.get('Set-Cookie')).toBe(SESSION_COOKIE)
	})
})
