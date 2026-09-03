/**
 * Rotation, checked against the authorization path it exists to fix.
 *
 * Asserting that `hashedKey` changed would only prove the repository agrees
 * with itself. What matters is the thing a customer experiences: after a
 * rotation the old snippet stops working and the new one starts, with the same
 * key row, name and project scope. So every assertion here goes through
 * `validatePreviewApiKeyForProject` - the same function `/embed` calls.
 *
 * Opt-in, because it writes to whatever `DATABASE_URL` points at:
 *
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 *
 * Every row it creates is namespaced by a fresh uuid and dropped in `afterAll`.
 */

import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Schema = typeof import('../../app/db/schema')
type Repository =
	typeof import('../../app/lib/domain/auth/api-key-repository.server')
type PreviewAuth =
	typeof import('../../app/lib/domain/auth/preview-api-key-auth.server')
type Cipher = typeof import('../../app/lib/security/embed-token-cipher.server')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

/**
 * A request shaped like a real embed load.
 *
 * The referer host matches the application host, which
 * `isEmbedRequestHostAllowed` allows outright, so these assertions turn on the
 * key and never on the project's domain list.
 */
function embedRequest(projectId: string, sceneId: string, token: string) {
	return new Request(
		`https://embed.test/embed/${projectId}/${sceneId}?token=${encodeURIComponent(token)}`,
		{ headers: { referer: 'https://embed.test/product/widget' } }
	)
}

describe('api key rotation', () => {
	// Loaded in `beforeAll` rather than at module scope: these modules call
	// `getDbClient()` on import, which throws without a `DATABASE_URL`.
	let schema: Schema
	let createApiKey: Repository['createApiKey']
	let rotateApiKey: Repository['rotateApiKey']
	let revokeApiKey: Repository['revokeApiKey']
	let validatePreviewApiKeyForProject: PreviewAuth['validatePreviewApiKeyForProject']
	let decryptEmbedToken: Cipher['decryptEmbedToken']
	let db: Db

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const sceneId = randomUUID()

	let apiKeyId: string
	let originalPlaintext: string
	let rotatedPlaintext: string

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		;({ createApiKey, rotateApiKey, revokeApiKey } =
			await import('../../app/lib/domain/auth/api-key-repository.server'))
		;({ validatePreviewApiKeyForProject } =
			await import('../../app/lib/domain/auth/preview-api-key-auth.server'))
		;({ decryptEmbedToken } =
			await import('../../app/lib/security/embed-token-cipher.server'))
		db = (await import('../../app/db/client')).getDbClient()

		await db.insert(schema.users).values({
			id: ownerId,
			email: `owner-${ownerId}@rotate.test`,
			name: 'Owner'
		})
		await db
			.insert(schema.organizations)
			.values({ id: organizationId, name: `rotate-${organizationId}`, ownerId })
		await db.insert(schema.organizationMemberships).values({
			userId: ownerId,
			organizationId,
			role: 'owner'
		})
		await db.insert(schema.projects).values({
			id: projectId,
			organizationId,
			name: 'Rotate project',
			slug: `rotate-${projectId}`
		})

		const created = await createApiKey({
			userId: ownerId,
			organizationId,
			name: 'Storefront key',
			description: 'Pasted into a product page',
			projectIds: [projectId]
		})

		apiKeyId = created.apiKey.id
		originalPlaintext = created.plaintext
	})

	afterAll(async () => {
		if (!db) return
		await db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, apiKeyId))
		await db.delete(schema.projects).where(eq(schema.projects.id, projectId))
		await db
			.delete(schema.organizationMemberships)
			.where(eq(schema.organizationMemberships.userId, ownerId))
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db.delete(schema.users).where(eq(schema.users.id, ownerId))
	})

	it('authorizes an embed with the key it just minted', async () => {
		const decision = await validatePreviewApiKeyForProject({
			request: embedRequest(projectId, sceneId, originalPlaintext),
			projectId
		})

		expect(decision.ok).toBe(true)
	})

	it('stores the same secret twice, in the two forms that need it', async () => {
		/*
		  The invariant between the halves, and the reason this lives here rather
		  than beside the cipher.

		  `hashedKey` is what an embed request is matched against; `encryptedKey`
		  is what the panel shows an owner so they can pick a key they already
		  made. Those are two representations of one secret, written by one
		  insert, and nothing in the type system says they describe the same
		  value. If a later change writes a different token into one of them - or
		  stops writing one - every unit test still passes and the panel starts
		  handing out a snippet that authorizes nothing.

		  So this reads the stored ciphertext out of the database, decrypts it,
		  and puts the result through the same function `/embed` calls.
		*/
		const [row] = await db
			.select({ encryptedKey: schema.apiKeys.encryptedKey })
			.from(schema.apiKeys)
			.where(eq(schema.apiKeys.id, apiKeyId))

		/*
		  Exact equality against the minted plaintext is the whole assertion. An
		  earlier version also pushed `stored` through
		  `validatePreviewApiKeyForProject` and asserted it authorized, which
		  reads as the load-bearing half and cannot fail independently: `stored`
		  is already proven identical to `originalPlaintext`, and the test above
		  already proved that value authorizes. Two ways of saying one thing.
		*/
		expect(decryptEmbedToken(row.encryptedKey)).toBe(originalPlaintext)
	})

	it('hands back a new secret and keeps everything else', async () => {
		const rotated = await rotateApiKey({ apiKeyId, userId: ownerId })
		rotatedPlaintext = rotated.plaintext

		expect(rotatedPlaintext).not.toBe(originalPlaintext)
		expect(rotated.apiKey.id).toBe(apiKeyId)
		expect(rotated.apiKey.name).toBe('Storefront key')
		expect(rotated.apiKey.description).toBe('Pasted into a product page')
		expect(rotated.projects.map((project) => project.id)).toEqual([projectId])
		expect(rotated.apiKey.keyPreview).toBe(rotatedPlaintext.slice(-4))
		expect(rotated.apiKey.rotatedAt).not.toBeNull()

		/*
		  Cleared on purpose. Carried over, it would read as "the new key is
		  already in use" from the moment it was minted, and that field is exactly
		  what an owner checks to confirm the storefront picked the new key up.
		*/
		expect(rotated.apiKey.lastUsedAt).toBeNull()
	})

	it('rewrites the stored value on rotation rather than leaving the old one', async () => {
		/*
		  A stale `encryptedKey` here is worse than an absent one: the panel would
		  confidently hand out the secret this rotation just replaced, which is
		  the exact failure rotation exists to end, and the key would look fine in
		  every listing while every snippet built from it 404s.
		*/
		const [row] = await db
			.select({ encryptedKey: schema.apiKeys.encryptedKey })
			.from(schema.apiKeys)
			.where(eq(schema.apiKeys.id, apiKeyId))

		expect(decryptEmbedToken(row.encryptedKey)).toBe(rotatedPlaintext)
		expect(decryptEmbedToken(row.encryptedKey)).not.toBe(originalPlaintext)
	})

	it('refuses the key that was in the old snippet', async () => {
		const decision = await validatePreviewApiKeyForProject({
			request: embedRequest(projectId, sceneId, originalPlaintext),
			projectId
		})

		expect(decision).toEqual({ ok: false, error: 'invalid_token' })
	})

	it('authorizes the key from the new snippet', async () => {
		const decision = await validatePreviewApiKeyForProject({
			request: embedRequest(projectId, sceneId, rotatedPlaintext),
			projectId
		})

		expect(decision.ok).toBe(true)
	})

	it('records the use, so the dashboard can tell the key was picked up', async () => {
		/*
		  Every other assertion here stops at `decision.ok`, which leaves the
		  `lastUsedAt` write itself untested - and that column is the whole basis
		  of the "Unused since rotating" warning. Without this, deleting the write
		  would keep the suite green while the dashboard silently reported every
		  rotated key as never adopted.
		*/
		const [row] = await db
			.select({ lastUsedAt: schema.apiKeys.lastUsedAt })
			.from(schema.apiKeys)
			.where(eq(schema.apiKeys.id, apiKeyId))

		expect(row.lastUsedAt).not.toBeNull()
	})

	it('never reports success for a rotation that lost a race', async () => {
		/*
		  Both callers read the row before either writes, so both hold the same
		  starting secret. Without the compare-and-swap on `hashedKey` both
		  updates match and both return success, leaving one admin holding a
		  plaintext that authorizes nothing - presented as the new live key.
		*/
		/*
		  Establish two pooled connections before racing. postgres.js opens them
		  lazily, so the second caller spends its first moments on a connect-and-
		  auth handshake while the first completes all four of its round trips on
		  the already-warm socket. The second then reads the secret the first just
		  wrote, its compare-and-swap matches, and both report success - which is
		  not the guard failing, it is the race never happening.

		  This test passed for a while on nothing but luck: enough earlier queries
		  happened to leave two sockets warm. Removing a couple of queries
		  elsewhere in the suite was enough to undo that and turn the assertion
		  red, which is how the dependency surfaced.

		  `reserve()` waits for an established connection rather than inferring one
		  from a query that happens to need it, so this states the precondition
		  instead of relying on a side effect.
		*/
		const pool = (
			db as unknown as { $client: { reserve(): Promise<{ release(): void }> } }
		).$client
		const reserved = await Promise.all([pool.reserve(), pool.reserve()])
		reserved.forEach((connection) => connection.release())

		const results = await Promise.allSettled([
			rotateApiKey({ apiKeyId, userId: ownerId }),
			rotateApiKey({ apiKeyId, userId: ownerId })
		])

		const winners = results.filter(
			(
				result
			): result is PromiseFulfilledResult<
				Awaited<ReturnType<typeof rotateApiKey>>
			> => result.status === 'fulfilled'
		)

		expect(winners).toHaveLength(1)

		/*
		  And the loser lost for the stated reason. Filtering on `status` alone
		  accepts any failure - a dropped connection, a permission throw, a raw
		  serialization error - so a compare-and-swap replaced by something that
		  fails less usefully would still pass.
		*/
		const loser = results.find((result) => result.status === 'rejected')
		expect(String((loser as PromiseRejectedResult).reason)).toMatch(
			/changed while it was being rotated/
		)

		rotatedPlaintext = winners[0].value.plaintext
		const decision = await validatePreviewApiKeyForProject({
			request: embedRequest(projectId, sceneId, rotatedPlaintext),
			projectId
		})
		expect(decision.ok).toBe(true)
	})

	it('refuses to rotate an expired key', async () => {
		await db
			.update(schema.apiKeys)
			.set({ expiresAt: new Date(Date.now() - 60_000) })
			.where(eq(schema.apiKeys.id, apiKeyId))

		await expect(rotateApiKey({ apiKeyId, userId: ownerId })).rejects.toThrow(
			/expired/
		)

		await db
			.update(schema.apiKeys)
			.set({ expiresAt: null })
			.where(eq(schema.apiKeys.id, apiKeyId))
	})

	it('refuses to rotate a revoked key, so revoking stays final', async () => {
		await revokeApiKey(apiKeyId, ownerId)

		await expect(rotateApiKey({ apiKeyId, userId: ownerId })).rejects.toThrow(
			/revoked/
		)

		const decision = await validatePreviewApiKeyForProject({
			request: embedRequest(projectId, sceneId, rotatedPlaintext),
			projectId
		})

		expect(decision).toEqual({ ok: false, error: 'invalid_token' })
	})
})
