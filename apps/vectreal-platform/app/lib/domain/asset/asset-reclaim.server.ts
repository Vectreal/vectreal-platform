import { and, eq, notInArray, sql } from 'drizzle-orm'

import {
	deleteAssets,
	findAssetFolderId,
	selectUnreferencedAssetIds,
	selectUnreferencedAssetIdsInFolder
} from './asset-storage.server'
import { getDbClient } from '../../../db/client'
import { assets } from '../../../db/schema'

const db = getDbClient()

/**
 * How long an unreferenced asset must sit before the project-wide sweep will
 * touch it.
 *
 * The sweep's scope is the whole project rather than one request, so it cannot
 * tell an abandoned upload from one whose commit is still in flight - and
 * uploads are serialized against nothing, since `runWithSceneWriteLock` guards
 * only the three commit actions. A day is far longer than any upload leg and
 * costs only delayed collection.
 */
const STALE_ASSET_HOURS = 24

/** How many stale candidates one save is willing to examine. */
const STALE_SWEEP_BATCH = 200

/**
 * Runs one reclaim, swallowing every failure.
 *
 * The guard covers the candidate lookup as well as the delete, and that is the
 * point rather than an accident. These run after the save or publish has
 * committed - one of them from a `finally`, where a throw discards the pending
 * `return` and turns a landed publish into a 500. A cleanup must never be able
 * to fail the operation that triggered it, so nothing inside here may throw.
 */
async function collect(
	context: string,
	findCandidates: () => Promise<string[]>
): Promise<string[]> {
	try {
		const candidateAssetIds = await findCandidates()

		if (candidateAssetIds.length === 0) return []

		// `selectUnreferencedAssetIds` is the single gate in front of every asset
		// delete in the codebase. Reclaim narrows what to ask about; it never
		// decides what is safe.
		const orphaned = await selectUnreferencedAssetIds(candidateAssetIds)

		if (orphaned.length > 0) {
			await deleteAssets(orphaned)
		}

		return orphaned
	} catch (error) {
		console.warn('[asset-reclaim] reclaim failed', { context, error })
		return []
	}
}

/**
 * Reclaims assets an upload batch uploaded but never linked.
 *
 * Uploads happen in their own requests before `commit-scene-save`, so a commit
 * that is rejected on quota or entitlement - or a browser tab closed mid-save -
 * leaves every uploaded row referenced by nothing. Such a row is invisible to
 * the save-path collector, which only considers assets that were previously
 * linked, and to the scene-delete collector, which reads the link tables.
 * Nothing else will ever find it.
 *
 * The scope is the batch's `requestId`, and it is exact rather than approximate
 * because a row can belong to only one batch: `findExistingAsset` reuses a row
 * only once something references it, so a row still in flight is never shared.
 * Without that rule this would be unsafe in a way no grace window fixes - two
 * concurrent saves would share a deduplicated row, and whichever failed first
 * would delete an asset the other was about to link. It is exact for rows in
 * flight, not for every race: a reused row that loses its last reference before
 * the reusing batch commits becomes collectable again, which fails that save
 * rather than corrupting a scene.
 *
 * A rejection that happens before this function's caller is entered - the write
 * lock's 409, the heavy-action 503, the idempotency 409 - reclaims nothing, and
 * those uploads wait for `reclaimStaleProjectAssets`.
 */
export async function reclaimUploadBatch(params: {
	requestId: string | undefined
	projectId: string
	keepAssetIds?: string[]
}): Promise<string[]> {
	const { requestId, projectId, keepAssetIds = [] } = params

	if (!requestId) return []

	return collect(`upload-batch:${requestId}`, async () => {
		const folderId = await findAssetFolderId(projectId)
		if (!folderId) return []

		// `folderId` leads so `assets_folder_id_idx` drives the plan; the json
		// comparison is a recheck over one project's assets, not a table scan.
		const candidates = await db
			.select({ id: assets.id })
			.from(assets)
			.where(
				and(
					eq(assets.folderId, folderId),
					sql`${assets.metadata}->>'requestId' = ${requestId}`,
					keepAssetIds.length > 0
						? notInArray(assets.id, keepAssetIds)
						: undefined
				)
			)

		return candidates.map((row) => row.id)
	})
}

/**
 * Sweeps a project's asset folder for anything unreferenced and old enough to
 * be certainly abandoned.
 *
 * This is the backstop for batches that never reached a commit at all, so no
 * later request ever carries their id, and for rejections that never reach
 * `reclaimUploadBatch`. It runs off a successful save, which is the only
 * in-band trigger available without a scheduler.
 *
 * Bounded, because a mature project's asset folder holds thousands of rows - a
 * dev database already has 597 in one folder - and this runs inline on a
 * routine save. The bound is only safe because the page is drawn from rows the
 * query has already established are unreferenced; see
 * `selectUnreferencedAssetIdsInFolder` for why filtering afterwards would
 * starve instead.
 */
export async function reclaimStaleProjectAssets(params: {
	projectId: string
	olderThanHours?: number
	limit?: number
}): Promise<string[]> {
	const {
		projectId,
		olderThanHours = STALE_ASSET_HOURS,
		limit = STALE_SWEEP_BATCH
	} = params

	return collect(`stale-project:${projectId}`, async () => {
		const folderId = await findAssetFolderId(projectId)
		if (!folderId) return []

		return selectUnreferencedAssetIdsInFolder({
			folderId,
			createdBefore: new Date(Date.now() - olderThanHours * 60 * 60 * 1000),
			limit
		})
	})
}
