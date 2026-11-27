import {
	and,
	count,
	countDistinct,
	desc,
	eq,
	gt,
	inArray,
	lt,
	sql
} from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { organizationMemberships } from '../../../db/schema/core/organization-memberships'
import { assets } from '../../../db/schema/project/assets'
import { projects } from '../../../db/schema/project/projects'
import { scenePublished } from '../../../db/schema/project/scene-published'
import { sceneStats } from '../../../db/schema/project/scene-stats'
import { scenes } from '../../../db/schema/project/scenes'

import type { DashboardFacts } from './dashboard-tidbits'

const db = getDbClient()

/*
  A size or vertex count is only summed where the scene has both halves of it.
  A scene saved before stats were recorded, or never measured, would otherwise
  add its original and no result, and the "saved" figure would grow by its
  whole weight.

  The current size is the published GLB as stored, so a scene counts once it
  has been published: the saving is what visitors no longer download. Read
  from the file, not `scene_stats.current_scene_bytes`, a copy that saves
  before #1047 overwrote with their own projection.
*/
const publishedBytes = assets.fileSize
const hasBothSizes = sql`${sceneStats.initialSceneBytes} > 0 and ${publishedBytes} > 0`
/*
  The snapshots are untyped json written by the client. A hard cast would throw
  on one malformed row and take the whole dashboard down with it, so anything
  that is not a JSON number counts as unmeasured instead.
*/
const vertexCount = (
	snapshot: typeof sceneStats.baseline | typeof sceneStats.optimized
) =>
	sql`case when json_typeof(${snapshot} -> 'verticesCount') = 'number' then (${snapshot} ->> 'verticesCount')::numeric end`
const verticesBefore = vertexCount(sceneStats.baseline)
const verticesAfter = vertexCount(sceneStats.optimized)
const hasBothVertexCounts = sql`${verticesBefore} is not null and ${verticesAfter} is not null`

/** `sum` comes back from Postgres as a string, and as null over no rows. */
const asNumber = (value: unknown) => Number(value ?? 0)

/**
 * The figures behind the dashboard's opening fact.
 *
 * Scoped to the organizations the user belongs to, which is the whole
 * authorization: RLS is inert for app traffic. A subquery rather than a join,
 * because nothing makes a membership row unique per organization, and a joined
 * duplicate would double every sum. Two queries rather than
 * one, because the largest cut is a single row and the rest are sums, and
 * folding an ordered row into an aggregate costs more reading than it saves.
 */
export async function getDashboardFactsForUser(
	userId: string
): Promise<DashboardFacts> {
	const inUsersOrganizations = inArray(
		projects.organizationId,
		db
			.select({ id: organizationMemberships.organizationId })
			.from(organizationMemberships)
			.where(eq(organizationMemberships.userId, userId))
	)

	const [[totals], [cut]] = await Promise.all([
		db
			.select({
				sceneCount: count(scenes.id),
				projectCount: countDistinct(scenes.projectId),
				publishedCount: sql<number>`count(*) filter (where ${scenes.status} = 'published')`,
				initialBytes: sql<string>`sum(${sceneStats.initialSceneBytes}) filter (where ${hasBothSizes})`,
				currentBytes: sql<string>`sum(${publishedBytes}) filter (where ${hasBothSizes})`,
				measuredSceneCount: sql<number>`count(*) filter (where ${hasBothSizes})`,
				verticesBefore: sql<string>`sum(${verticesBefore}) filter (where ${hasBothVertexCounts})`,
				verticesAfter: sql<string>`sum(${verticesAfter}) filter (where ${hasBothVertexCounts})`
			})
			.from(scenes)
			.innerJoin(projects, eq(projects.id, scenes.projectId))
			.leftJoin(sceneStats, eq(sceneStats.sceneId, scenes.id))
			.leftJoin(scenePublished, eq(scenePublished.sceneId, scenes.id))
			.leftJoin(assets, eq(assets.id, scenePublished.assetId))
			.where(inUsersOrganizations),
		db
			.select({
				sceneName: scenes.name,
				initialBytes: sceneStats.initialSceneBytes,
				currentBytes: publishedBytes
			})
			.from(scenes)
			.innerJoin(projects, eq(projects.id, scenes.projectId))
			.innerJoin(sceneStats, eq(sceneStats.sceneId, scenes.id))
			.innerJoin(scenePublished, eq(scenePublished.sceneId, scenes.id))
			.innerJoin(assets, eq(assets.id, scenePublished.assetId))
			.where(
				and(
					inUsersOrganizations,
					gt(publishedBytes, 0),
					lt(publishedBytes, sceneStats.initialSceneBytes)
				)
			)
			.orderBy(
				desc(
					sql`1 - ${publishedBytes}::float8 / ${sceneStats.initialSceneBytes}`
				)
			)
			.limit(1)
	])

	return {
		sceneCount: asNumber(totals?.sceneCount),
		projectCount: asNumber(totals?.projectCount),
		publishedCount: asNumber(totals?.publishedCount),
		initialBytes: asNumber(totals?.initialBytes),
		currentBytes: asNumber(totals?.currentBytes),
		measuredSceneCount: asNumber(totals?.measuredSceneCount),
		verticesBefore: asNumber(totals?.verticesBefore),
		verticesAfter: asNumber(totals?.verticesAfter),
		biggestCut:
			cut?.initialBytes && cut.currentBytes
				? {
						sceneName: cut.sceneName,
						initialBytes: cut.initialBytes,
						currentBytes: cut.currentBytes
					}
				: null
	}
}
