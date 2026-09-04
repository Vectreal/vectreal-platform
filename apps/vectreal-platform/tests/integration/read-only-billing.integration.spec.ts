/**
 * Asks a real Postgres whether an organization in a read-only billing state can
 * still upload.
 *
 * `scene_upload` has sat in `READ_ONLY_BLOCKED_ENTITLEMENTS` since that set was
 * written, and `entitlement-service.server.ts` documents it as blocking
 * uploads, but no call site ever passed the key - so the set membership was
 * guard infrastructure with no guard, and an `unpaid` organization kept
 * uploading while its sibling `scene_publish` correctly refused.
 *
 * The key is `true` on every plan, so it can only ever deny on billing state.
 * That is why both tests below move `billing_state` rather than the plan, and
 * why the assertion is about a payment rather than an upgrade.
 *
 * Opt-in:
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'

import { eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type SceneOps =
	typeof import('../../app/lib/domain/scene/server/scene-settings.operations.server')

describe('uploads while billing is read-only', () => {
	let schema: Schema
	let db: Db
	let sceneOps: SceneOps

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()

	// A second organization the caller was invited into, holding a scene of its
	// own. The guard has to grade this one when that scene is the one being
	// uploaded to, whatever state the caller's own organization is in.
	/*
	  A user who owns nothing. The rejection test below has to run as someone
	  `getOrCreateDefaultOrganization` would genuinely create an organization
	  for - the fixture owner acquires one from an earlier test, which made the
	  same assertion pass whether or not the guard rejected.
	*/
	const strayUserId = randomUUID()

	const hostId = randomUUID()
	const invitedOrgId = randomUUID()
	const invitedProjectId = randomUUID()
	const invitedSceneId = randomUUID()

	const setBillingState = async (
		billingState: 'active' | 'unpaid' | 'paused',
		org: string = organizationId
	) => {
		await db
			.delete(schema.orgSubscriptions)
			.where(eq(schema.orgSubscriptions.organizationId, org))
		await db
			.insert(schema.orgSubscriptions)
			.values({ organizationId: org, plan: 'pro', billingState })
	}

	const thrownBy = async (
		request: Parameters<SceneOps['prepareSceneUpload']>[0]
	) =>
		sceneOps
			.prepareSceneUpload(request, ownerId)
			.catch((e: unknown) => e) as Promise<{
			entitlementKey?: string
			billingState?: string
			upgradeTo?: string | null
		}>

	const prepare = () =>
		sceneOps.prepareSceneUpload(
			{
				action: 'prepare-scene-upload',
				requestId: randomUUID(),
				targetProjectId: projectId
			},
			ownerId
		)

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		sceneOps =
			await import('../../app/lib/domain/scene/server/scene-settings.operations.server')

		await db
			.insert(schema.users)
			.values({ id: ownerId, email: `owner-${ownerId}@ro.test`, name: 'Owner' })
		/*
		  Deliberately NOT named 'My Organization'. `getOrCreateDefaultOrganization`
		  matches on that literal and creates one when it misses, and the guard
		  used to reach it on every upload. Naming the fixture anything else means
		  a regression back to that fallback resolves a freshly created, always
		  granted organization - and every refusal assertion below goes green when
		  it should not. The name is the assertion.
		*/
		await db.insert(schema.organizations).values({
			id: organizationId,
			name: `read-only-${organizationId}`,
			ownerId
		})
		await db
			.insert(schema.organizationMemberships)
			.values({ userId: ownerId, organizationId, role: 'owner' })
		await db.insert(schema.projects).values({
			id: projectId,
			organizationId,
			name: 'Read-only project',
			slug: `ro-${projectId}`
		})

		// The invited organization, owned by someone else, with the caller as a
		// plain member and a scene that lives there.
		await db.insert(schema.users).values([
			{ id: hostId, email: `host-${hostId}@ro.test`, name: 'Host' },
			{ id: strayUserId, email: `stray-${strayUserId}@ro.test`, name: 'Stray' }
		])
		await db.insert(schema.organizations).values({
			id: invitedOrgId,
			name: `invited-${invitedOrgId}`,
			ownerId: hostId
		})
		await db.insert(schema.organizationMemberships).values([
			{ userId: hostId, organizationId: invitedOrgId, role: 'owner' },
			{ userId: ownerId, organizationId: invitedOrgId, role: 'member' }
		])
		await db.insert(schema.projects).values({
			id: invitedProjectId,
			organizationId: invitedOrgId,
			name: 'Invited project',
			slug: `inv-${invitedProjectId}`
		})
		await db.insert(schema.scenes).values({
			id: invitedSceneId,
			projectId: invitedProjectId,
			folderId: null,
			name: 'invited scene'
		})
	})

	afterAll(async () => {
		if (!db) return
		await db
			.delete(schema.orgSubscriptions)
			.where(
				inArray(schema.orgSubscriptions.organizationId, [
					organizationId,
					invitedOrgId
				])
			)
		await db.delete(schema.scenes).where(eq(schema.scenes.projectId, projectId))
		await db
			.delete(schema.projects)
			.where(
				inArray(schema.projects.organizationId, [organizationId, invitedOrgId])
			)
		await db
			.delete(schema.organizationMemberships)
			.where(
				inArray(schema.organizationMemberships.organizationId, [
					organizationId,
					invitedOrgId
				])
			)
		await db
			.delete(schema.organizations)
			.where(inArray(schema.organizations.id, [organizationId, invitedOrgId]))
		// The no-destination test makes `getOrCreateDefaultOrganization` create
		// one, so sweep anything else this user came to own.
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.ownerId, ownerId))
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.ownerId, strayUserId))
		await db
			.delete(schema.users)
			.where(inArray(schema.users.id, [ownerId, hostId, strayUserId]))
	})

	it('refuses an upload when payment has lapsed', async () => {
		await setBillingState('unpaid')
		await expect(prepare()).rejects.toThrow(
			/payment required to restore access/
		)

		/*
		  The message is built from `billingState` in one place and the field is
		  set from it in another, and only the field reaches the route, where it
		  picks 402 over 403. A regression hardcoding it leaves this message
		  correct and turns every payment prompt into "upgrade your plan" for an
		  organization that already owns the entitlement.

		  The key matters too: `scene_publish` sits in the same read-only set, so
		  a guard consulting the wrong one of the two would deny identically.
		*/
		const thrown = await thrownBy({
			action: 'prepare-scene-upload',
			requestId: randomUUID(),
			targetProjectId: projectId
		})
		expect(thrown.entitlementKey).toBe('scene_upload')
		expect(thrown.billingState).toBe('unpaid')
	})

	it('refuses an upload while the subscription is paused', async () => {
		await setBillingState('paused')
		await expect(prepare()).rejects.toThrow(
			/payment required to restore access/
		)

		const thrown = await thrownBy({
			action: 'prepare-scene-upload',
			requestId: randomUUID(),
			targetProjectId: projectId
		})
		expect(thrown.billingState).toBe('paused')
	})

	it("follows the organization that owns the scene, not the caller's own", async () => {
		/*
		  No `targetProjectId`, which is what `upload-published-glb` sends - so the
		  organization has to come from the scene. Resolving it from the caller
		  instead let a read-only organization keep publishing whenever the person
		  doing it had a healthy organization of their own.
		*/
		await setBillingState('active')
		await setBillingState('unpaid', invitedOrgId)

		await expect(
			sceneOps.prepareSceneUpload(
				{
					action: 'prepare-scene-upload',
					requestId: randomUUID(),
					sceneId: invitedSceneId
				},
				ownerId
			)
		).rejects.toThrow(/payment required to restore access/)
	})

	it('grades the project a first save names, before its scene row exists', async () => {
		/*
		  `prepareSceneUpload` mints the scene id and nothing writes the row until
		  `commit-scene-save`, so every upload of a first save carries an id that
		  resolves to no project. `resolveSceneAndProject` falls back to
		  `projectId` for exactly that case, and the guard has to read the same
		  field or it grades the caller's own organization while the bytes land in
		  this one.
		*/
		await setBillingState('active')
		await setBillingState('unpaid', invitedOrgId)

		await expect(
			sceneOps.prepareSceneUpload(
				{
					action: 'prepare-scene-upload',
					requestId: randomUUID(),
					sceneId: randomUUID(),
					projectId: invitedProjectId
				},
				ownerId
			)
		).rejects.toThrow(/payment required to restore access/)
	})

	it('ignores a named project when no scene id says the scene will land there', async () => {
		/*
		  `resolveSceneAndProject` consults `projectId` only for a scene id whose
		  row does not exist yet. With no scene id at all it ignores the field and
		  creates the scene in the caller's own default project, so grading the
		  named project's organization would be a bypass in one direction - a
		  lapsed caller naming any healthy project they belong to - and a false
		  refusal in the other.

		  The invited organization is read-only here and the request names its
		  project, so a guard reading the field out of turn refuses. The scene is
		  not going there, so the correct answer is to let it through.
		*/
		await setBillingState('unpaid', invitedOrgId)

		const prepared = await sceneOps.prepareSceneUpload(
			{
				action: 'prepare-scene-upload',
				requestId: randomUUID(),
				projectId: invitedProjectId
			},
			ownerId
		)
		expect(prepared.projectId).not.toBe(invitedProjectId)
	})

	it('rejects a scene id that names nothing, without creating an organization', async () => {
		/*
		  `resolveSceneAndProject` throws for this shape, so the guard has to as
		  well. Falling through to the caller's default organization would resolve
		  it - and `getOrCreateDefaultOrganization` matches on a literal name, so
		  for anyone who renamed theirs it inserts an organization, a membership
		  and a subscription on the way to a request that cannot succeed.
		*/
		/*
		  Scoped to the stray user. Integration spec files run in parallel against
		  one database and every sibling inserts and deletes organizations, so an
		  unfiltered count can fail spuriously - or, worse, have a sibling's delete
		  cancel out the insert this assertion exists to catch.
		*/
		const ownedByStray = () =>
			db
				.select({ id: schema.organizations.id })
				.from(schema.organizations)
				.where(eq(schema.organizations.ownerId, strayUserId))

		const before = await ownedByStray()

		/*
		  As `strayUserId`, who owns no organization. `resolveSceneAndProject`
		  throws the same sentence for this shape, so the message alone proves
		  nothing about which function refused - the organization count is the
		  assertion, and it only moves for a user the fallback would create one
		  for.
		*/
		await expect(
			sceneOps.prepareSceneUpload(
				{
					action: 'prepare-scene-upload',
					requestId: randomUUID(),
					sceneId: randomUUID()
				},
				strayUserId
			)
		).rejects.toThrow(/Scene not found with ID/)

		expect((await ownedByStray()).length).toBe(before.length)
	})

	it("does not refuse work in a healthy organization because the caller's own lapsed", async () => {
		// The other direction, and the one a customer would notice: legitimate
		// work in an organization that is paid up, refused because the person
		// doing it has an unpaid organization of their own somewhere else.
		await setBillingState('unpaid')
		await setBillingState('active', invitedOrgId)

		const prepared = await sceneOps.prepareSceneUpload(
			{
				action: 'prepare-scene-upload',
				requestId: randomUUID(),
				sceneId: invitedSceneId
			},
			ownerId
		)
		expect(prepared.projectId).toBe(invitedProjectId)
	})

	it('allows an upload once billing is current again', async () => {
		/*
		  The other half. Without this a guard that refused unconditionally would
		  pass both tests above, and uploads would be dead for everyone.
		*/
		await setBillingState('active')
		const prepared = await prepare()
		expect(prepared.sceneId).toBeTruthy()
		expect(prepared.projectId).toBe(projectId)
	})
})
