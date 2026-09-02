// @vitest-environment jsdom
/**
 * What the API keys page sends to the browser.
 *
 * Three separate claims, and they are easy to confuse with each other:
 *
 *   - The **key itself** is sent, decrypted. It is public by construction -
 *     it ships in an `iframe src` on the customer's own page - and the embed
 *     panel has been reading it back since `encrypted_key` landed. The one
 *     screen that owns keys refusing to show it was the defect.
 *   - The **hash and the ciphertext** are still never sent. `hashedKey` is the
 *     only thing an embed request is matched against and has no reader in the
 *     browser at all; the ciphertext is an envelope nothing client-side can
 *     open.
 *   - **Which organizations get the value** is decided by the permission table,
 *     per organization. That check is the one this file is really here for:
 *     before it existed, the only thing restricting this page was a hardcoded
 *     role list inside `getAllUserApiKeys`, so tightening `api-key:read`
 *     changed nothing here at all.
 *
 * The field-list pin is what stops any of it being satisfied vacuously by a
 * loader that returns less than the page renders.
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

/** What that envelope stands for: the value the owner actually needs. */
const PLAINTEXT_KEY = 'vctrl_9Qm2LpXtRv4Kd8Nb1YwZc7HsAe3Uab3x'

vi.mock('../../db/client', () => ({ getDbClient: () => ({}) }))

vi.mock('../../lib/domain/auth/api-key-repository.server', () => ({
	getAllUserApiKeys: vi.fn(),
	getApiKeyById: vi.fn(),
	updateApiKey: vi.fn(),
	revokeApiKey: vi.fn(),
	rotateApiKey: vi.fn()
}))

vi.mock('../../lib/domain/project/project-repository.server', () => ({
	getUserProjects: vi.fn(async () => [
		{
			id: 'project-1',
			name: 'Storefront',
			slug: 'storefront',
			organizationId: 'org-1'
		}
	])
}))

vi.mock('../../lib/domain/auth/auth-loader.server', () => ({
	loadAuthenticatedUser: vi.fn(async () => ({
		user: { id: USER_ID },
		headers: new Headers()
	}))
}))

vi.mock('../../lib/domain/billing/entitlement-service.server', () => ({
	hasEntitlement: vi.fn(async () => ({ granted: true })),
	getOrgSubscription: vi.fn(async () => ({ plan: 'pro' })),
	getRecommendedUpgrade: vi.fn(() => 'business')
}))

vi.mock('../../lib/domain/user/user-repository.server', () => ({
	getUserOrganizations: vi.fn(async () => [
		{
			organization: { id: ORG_ID, name: 'Acme' },
			membership: { role: 'owner' }
		}
	])
}))

vi.mock('../../lib/http/csrf.server', () => ({
	ensureValidCsrfFormData: vi.fn(async () => null)
}))

/*
  Mocked so the permission check can be driven independently of role. The real
  implementation is the default, so every other test in this file exercises the
  genuine table.
*/
vi.mock('../../lib/domain/dashboard/dashboard-operations', async (original) => {
	const actual =
		await original<
			typeof import('../../lib/domain/dashboard/dashboard-operations')
		>()

	return {
		...actual,
		canPerformDashboardOperation: vi.fn(actual.canPerformDashboardOperation)
	}
})

/*
  The cipher is stubbed rather than configured, so this file never depends on
  `EMBED_TOKEN_ENCRYPTION_KEY` being set in the test environment. It is a spy,
  not a constant: two tests below assert it was *not* called, which is how
  "filtered before decrypting" is checked at all.
*/
vi.mock('../../lib/security/embed-token-cipher.server', () => ({
	decryptEmbedToken: vi.fn((envelope: string | null) =>
		envelope === ENCRYPTED_KEY ? PLAINTEXT_KEY : null
	)
}))

import { loader } from './api-keys'
import { loader as editLoader } from './api-keys-edit'
import {
	getAllUserApiKeys,
	getApiKeyById
} from '../../lib/domain/auth/api-key-repository.server'
import { hasEntitlement } from '../../lib/domain/billing/entitlement-service.server'
import { canPerformDashboardOperation } from '../../lib/domain/dashboard/dashboard-operations'
import { getUserOrganizations } from '../../lib/domain/user/user-repository.server'
import { decryptEmbedToken } from '../../lib/security/embed-token-cipher.server'

import type { LoaderFunctionArgs } from 'react-router'

/** A row exactly as the repository hands it over, secrets included. */
function storedKey() {
	return {
		apiKey: {
			id: 'key-1',
			name: 'Storefront key',
			description: 'Pasted into a product page',
			keyPreview: 'ab3x',
			kind: 'embed' as const,
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

const firstRow = (data: Record<string, unknown>) => {
	const { keysByOrg } = data as {
		keysByOrg: Record<string, Array<Record<string, unknown>>>
	}

	return keysByOrg[ORG_ID]?.[0]
}

describe('the api keys loader payload', () => {
	it('hands the table the key it renders', async () => {
		/*
		  The point of the change. Without this, every assertion below is
		  satisfied by a loader that sends nothing at all - which is exactly what
		  this page did before, and what made it the only surface still hiding a
		  value the embed panel gives away.
		*/
		expect(firstRow((await load()).data)?.value).toEqual({
			readable: true,
			value: PLAINTEXT_KEY
		})
	})

	it('sends neither stored form of the secret', async () => {
		const payload = JSON.stringify((await load()).data)

		expect(payload).not.toContain('hashedKey')
		expect(payload).not.toContain('encryptedKey')

		/*
		  The values, not just the field names. Mapping a secret onto a field the
		  page does render - `value: { readable: true, value: key.apiKey.hashedKey }`
		  - satisfies a field-name check, because "hashedKey" was only ever a key
		  name.
		*/
		expect(payload).not.toContain(HASHED_KEY)
		expect(payload).not.toContain(ENCRYPTED_KEY)

		/*
		  The base64 payload segments only. Scanning for the `enc` and `v1` prefix
		  parts as bare substrings would fire the day any rendered field contains
		  them - a key named "Fence", a description mentioning a licence - and a
		  spec that fails on the data is worse than one that misses a case.
		*/
		for (const segment of ENCRYPTED_KEY.split(':').slice(2)) {
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
			'rotatedAt',
			'value'
		])
	})

	it('asks the permission table before resolving any value', async () => {
		/*
		  The check this whole file is here for, and the one that was missing.

		  Mocked at the predicate rather than driven by a role, because no role
		  currently distinguishes the two rules: `api-key:read` is owner|admin and
		  so is the `adminOrgs` filter above it. That coincidence is exactly the
		  problem - it means a role-driven test would pass without the loader ever
		  consulting the table, which is what this page did before.

		  Note what deleting this filter did *before* the change: nothing.
		  `getAllUserApiKeys` carries its own hardcoded
		  `inArray(role, ['admin', 'owner'])`, so every admin kept getting every
		  row however the operation table was set - and once the loader started
		  decrypting, that would have meant every plaintext.
		*/
		const real = vi.mocked(canPerformDashboardOperation).getMockImplementation()

		vi.mocked(canPerformDashboardOperation).mockImplementation(
			(operation) => operation !== 'api-key:read'
		)

		try {
			expect(firstRow((await load()).data)?.value).toEqual({
				readable: false,
				reason: 'withheld'
			})
			expect(decryptEmbedToken).not.toHaveBeenCalled()
		} finally {
			// Restored by hand: `clearAllMocks` resets recorded calls, not the
			// implementation, so leaving this set silently withholds every value in
			// every test declared after this one.
			vi.mocked(canPerformDashboardOperation).mockImplementation(real!)
		}
	})

	it('drops the rows of an organization it does not render at all', async () => {
		/*
		  A member never reaches the permission check above: `adminOrgs` has
		  already decided the organization gets no tab, so its rows leave the
		  payload entirely rather than arriving marked unreadable.
		*/
		vi.mocked(getUserOrganizations).mockResolvedValueOnce([
			{
				organization: { id: ORG_ID, name: 'Acme' },
				membership: { role: 'member' }
			}
		] as unknown as Awaited<ReturnType<typeof getUserOrganizations>>)

		expect(firstRow((await load()).data)).toBeUndefined()
		expect(decryptEmbedToken).not.toHaveBeenCalled()
	})

	it('does not read key values for an organization that cannot use the feature', async () => {
		/*
		  An organization without the entitlement renders `FeatureUnavailablePanel`
		  instead of a table, so decrypting its keys spends AES on markup that does
		  not exist and puts plaintext in memory for nobody to read.

		  The row survives, because the tab badge and the count sentence render
		  outside the entitlement branch and would otherwise report zero keys.
		*/
		vi.mocked(hasEntitlement).mockResolvedValueOnce({
			granted: false
		} as unknown as Awaited<ReturnType<typeof hasEntitlement>>)

		expect(firstRow((await load()).data)?.value).toEqual({
			readable: false,
			reason: 'withheld'
		})
		expect(decryptEmbedToken).not.toHaveBeenCalled()
	})

	it('sends no rows for an organization the page does not draw', async () => {
		/*
		  `getAllUserApiKeys` returns every key in every organization this actor
		  administers, and the component only reads the ones it has a tab for. A
		  row outside that set used to cost a preview; it would now cost a live key
		  in the payload of a page that never draws it.
		*/
		vi.mocked(getAllUserApiKeys).mockResolvedValue([
			{
				...storedKey(),
				organization: { id: 'org-elsewhere', name: 'Other' }
			}
		] as unknown as Awaited<ReturnType<typeof getAllUserApiKeys>>)

		const { keysByOrg } = (await load()).data as {
			keysByOrg: Record<string, unknown[]>
		}

		expect(keysByOrg).toEqual({})
		expect(decryptEmbedToken).not.toHaveBeenCalled()
	})

	it('says a revoked key was cleared, rather than telling anyone to rotate it', async () => {
		/*
		  Order, not two independent tests. `revokeApiKey` nulls the ciphertext on
		  purpose, so both branches fire for a revoked row - and `never-stored`
		  tells its owner to rotate, which `rotateApiKey` refuses for anything that
		  is not active. Reading the wrong one first is a wrong instruction, not a
		  cosmetic slip.
		*/
		vi.mocked(getAllUserApiKeys).mockResolvedValue([
			{
				...storedKey(),
				apiKey: {
					...storedKey().apiKey,
					active: false,
					encryptedKey: null,
					revokedAt: new Date('2026-02-01T00:00:00.000Z')
				}
			}
		] as unknown as Awaited<ReturnType<typeof getAllUserApiKeys>>)

		expect(firstRow((await load()).data)?.value).toEqual({
			readable: false,
			reason: 'revoked'
		})
	})

	it('separates a key that never stored a value from one that no longer decrypts', async () => {
		/*
		  The reason this field is a union and not `string | null`. The cipher
		  returns null for both, and the loader is the last place they are still
		  distinguishable - one is recoverable by rotating, the other means the
		  server key changed under every key at once.
		*/
		vi.mocked(getAllUserApiKeys).mockResolvedValue([
			{
				...storedKey(),
				apiKey: { ...storedKey().apiKey, id: 'key-none', encryptedKey: null }
			},
			{
				...storedKey(),
				apiKey: {
					...storedKey().apiKey,
					id: 'key-stale',
					encryptedKey: 'enc:v1:b3RoZXI=:b3RoZXI=:b3RoZXI='
				}
			}
		] as unknown as Awaited<ReturnType<typeof getAllUserApiKeys>>)

		const { keysByOrg } = (await load()).data as {
			keysByOrg: Record<string, Array<Record<string, unknown>>>
		}

		expect(keysByOrg[ORG_ID][0].value).toEqual({
			readable: false,
			reason: 'never-stored'
		})
		expect(keysByOrg[ORG_ID][1].value).toEqual({
			readable: false,
			reason: 'undecryptable'
		})
	})

	it('withholds the value of a kind that must not be disclosed', async () => {
		/*
		  Unreachable today - every row is an `embed` key - and asserted anyway,
		  because the whole point of the `kind` column is that the day a
		  write-scoped key exists, showing it has to be a decision rather than the
		  default this loader would otherwise apply.

		  Note it is withheld *before* the cipher runs: a key that must not be
		  disclosed should not have its plaintext put in memory to then be
		  discarded.
		*/
		vi.mocked(getAllUserApiKeys).mockResolvedValue([
			{
				...storedKey(),
				apiKey: { ...storedKey().apiKey, kind: 'server-write' }
			}
		] as unknown as Awaited<ReturnType<typeof getAllUserApiKeys>>)

		expect(firstRow((await load()).data)?.value).toEqual({
			readable: false,
			reason: 'withheld'
		})
		expect(decryptEmbedToken).not.toHaveBeenCalled()
	})

	it('still reads back an expired key', async () => {
		/*
		  This field answers "can it be read back", not "does it still work" - the
		  Status column already answers the second, from the same
		  `resolveApiKeyState`. An expired key's value is what identifies it in a
		  page that has started 404ing, which is the question that brings someone
		  to this screen.
		*/
		vi.mocked(getAllUserApiKeys).mockResolvedValue([
			{
				...storedKey(),
				apiKey: {
					...storedKey().apiKey,
					expiresAt: new Date('2026-01-02T00:00:00.000Z')
				}
			}
		] as unknown as Awaited<ReturnType<typeof getAllUserApiKeys>>)

		expect(firstRow((await load()).data)?.value).toEqual({
			readable: true,
			value: PLAINTEXT_KEY
		})
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
		expect(payload).not.toContain(ENCRYPTED_KEY)

		// Base64 payload segments only, for the reason the list loader's own scan
		// records: `enc` and `v1` are short enough to appear in rendered data.
		for (const segment of ENCRYPTED_KEY.split(':').slice(2)) {
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
