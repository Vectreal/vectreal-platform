// @vitest-environment jsdom
/**
 * What the API keys page sends to the browser.
 *
 * The loader used to return `ApiKeyWithDetails` rows straight from the
 * repository and let the component narrow them, so every response carried
 * `hashedKey` - and, once embed tokens became retrievable, the `encryptedKey`
 * ciphertext - for a page that renders neither. Nobody could see it who could
 * not already read those keys, which is exactly why nothing caught it: the
 * failure is a payload that is larger than the page, not a privilege boundary
 * that moved.
 *
 * So this asserts the shape of what leaves the server, in both directions: the
 * stored secret is absent, and the fields the table needs are present. Only the
 * second half stops the first from being satisfied by returning nothing at all.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const ORG_ID = 'org-1'
const USER_ID = 'user-1'
const HASHED_KEY =
	'9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'

/**
 * A literal envelope rather than a real encrypt.
 *
 * Depending on the cipher here would couple this spec to another module's key
 * configuration for no gain. Asserted whole, not just by its prefix: mapping a
 * fragment of it onto a field the page does render - `keyPreview:
 * key.apiKey.encryptedKey.split(':')[4]` - passes a prefix check.
 */
const ENCRYPTED_KEY = 'enc:v1:aWl2aXY=:dGFndGFn:Y2lwaGVy'

vi.mock('../app/db/client', () => ({ getDbClient: () => ({}) }))

vi.mock('../app/lib/domain/auth/api-key-repository.server', () => ({
	getAllUserApiKeys: vi.fn(),
	getApiKeyById: vi.fn(),
	updateApiKey: vi.fn(),
	revokeApiKey: vi.fn(),
	rotateApiKey: vi.fn()
}))

vi.mock('../app/lib/domain/project/project-repository.server', () => ({
	getUserProjects: vi.fn(async () => [
		{
			id: 'project-1',
			name: 'Storefront',
			slug: 'storefront',
			organizationId: 'org-1'
		}
	])
}))

vi.mock('../app/lib/domain/auth/auth-loader.server', () => ({
	loadAuthenticatedUser: vi.fn(async () => ({
		user: { id: USER_ID },
		headers: new Headers()
	}))
}))

vi.mock('../app/lib/domain/billing/entitlement-service.server', () => ({
	hasEntitlement: vi.fn(async () => ({ granted: true })),
	getOrgSubscription: vi.fn(async () => ({ plan: 'pro' })),
	getRecommendedUpgrade: vi.fn(() => 'business')
}))

vi.mock('../app/lib/domain/user/user-repository.server', () => ({
	getUserOrganizations: vi.fn(async () => [
		{
			organization: { id: ORG_ID, name: 'Acme' },
			membership: { role: 'owner' }
		}
	])
}))

vi.mock('../app/lib/http/csrf.server', () => ({
	ensureValidCsrfFormData: vi.fn(async () => null)
}))

import {
	getAllUserApiKeys,
	getApiKeyById
} from '../app/lib/domain/auth/api-key-repository.server'
import { loader } from '../app/routes/dashboard-page/api-keys'
import { loader as editLoader } from '../app/routes/dashboard-page/api-keys-edit'

import type { LoaderFunctionArgs } from 'react-router'

/** A row exactly as the repository hands it over, secrets included. */
function storedKey() {
	return {
		apiKey: {
			id: 'key-1',
			name: 'Storefront key',
			description: 'Pasted into a product page',
			keyPreview: 'ab3x',
			hashedKey: HASHED_KEY,
			encryptedKey: ENCRYPTED_KEY,
			active: true,
			lastUsedAt: null,
			expiresAt: null,
			revokedAt: null,
			rotatedAt: null,
			createdAt: new Date('2026-01-01T00:00:00.000Z')
		},
		creator: { id: USER_ID, name: 'Moritz', email: 'moritz@acme.test' },
		organization: { id: ORG_ID, name: 'Acme' },
		projects: [{ id: 'project-1', name: 'Storefront', slug: 'storefront' }]
	}
}

const load = async () => {
	const result = await loader({
		request: new Request('https://vectreal.com/dashboard/api-keys'),
		params: {},
		context: {}
	} as unknown as LoaderFunctionArgs)

	return result as unknown as { data: Record<string, unknown> }
}

beforeEach(() => {
	vi.clearAllMocks()
	vi.mocked(getAllUserApiKeys).mockResolvedValue([
		storedKey()
	] as unknown as Awaited<ReturnType<typeof getAllUserApiKeys>>)
})

describe('the api keys loader payload', () => {
	it('sends neither stored form of the secret', async () => {
		const payload = JSON.stringify((await load()).data)

		expect(payload).not.toContain('hashedKey')
		expect(payload).not.toContain('encryptedKey')

		/*
		  The values, not just the field names. Mapping a secret onto a field the
		  page does render - `keyPreview: key.apiKey.hashedKey` - satisfies a
		  field-name check, because "hashedKey" was only ever a key name.
		*/
		expect(payload).not.toContain(HASHED_KEY)
		for (const segment of ENCRYPTED_KEY.split(':')) {
			expect(payload, segment).not.toContain(segment)
		}
	})

	it('still sends everything the table renders', async () => {
		/*
		  The anchor. Without it, a loader that returned an empty object would
		  satisfy every assertion above.
		*/
		const { keysByOrg } = (await load()).data as {
			keysByOrg: Record<string, Array<Record<string, unknown>>>
		}

		expect(Object.keys(keysByOrg[ORG_ID][0]).sort()).toEqual([
			'active',
			'createdBy',
			'description',
			'expiresAt',
			'id',
			'keyPreview',
			'lastUsedAt',
			'name',
			'projects',
			'revokedAt',
			'rotatedAt'
		])
	})
})

describe('the api key edit loader payload', () => {
	/*
	  The hand-built literal is the fragile half of this change: re-adding the
	  whole row is a one-token edit, and the actor was being returned to a page
	  that never read it.
	*/
	const loadEdit = async () => {
		const result = await editLoader({
			request: new Request(
				'https://vectreal.com/dashboard/api-keys/key-1/edit'
			),
			params: { keyId: 'key-1' },
			context: {}
		} as unknown as LoaderFunctionArgs)

		return result as unknown as { data: Record<string, unknown> }
	}

	beforeEach(() => {
		vi.mocked(getApiKeyById).mockResolvedValue(
			storedKey() as unknown as Awaited<ReturnType<typeof getApiKeyById>>
		)
	})

	it('sends neither stored form of the secret, nor the actor', async () => {
		const { data } = await loadEdit()
		const payload = JSON.stringify(data)

		expect(payload).not.toContain('hashedKey')
		expect(payload).not.toContain('encryptedKey')
		expect(payload).not.toContain(HASHED_KEY)
		for (const segment of ENCRYPTED_KEY.split(':')) {
			expect(payload, segment).not.toContain(segment)
		}
		expect(data).not.toHaveProperty('user')
	})

	it('still sends the fields the form reads', async () => {
		const { data } = await loadEdit()
		const apiKeyData = data.apiKeyData as {
			apiKey: Record<string, unknown>
			organization: Record<string, unknown>
			projects: unknown[]
		}

		expect(Object.keys(apiKeyData.apiKey).sort()).toEqual([
			'description',
			'keyPreview',
			'name'
		])
		expect(apiKeyData.organization).toEqual({ id: ORG_ID })
		expect(apiKeyData.projects).toHaveLength(1)
	})
})
