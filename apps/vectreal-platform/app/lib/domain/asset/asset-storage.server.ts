import { randomUUID } from 'crypto'
import { createHash } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import {
	assets,
	folders,
	sceneAssets,
	scenePublished,
	scenes
} from '../../../db/schema'
import { reportServerError } from '../../observability/report-server-error.server'

import type { SceneAssetBinaryDataMap } from '../../../types/api'

export interface AssetUploadResult {
	assetId: string
	fileName: string
	filePath: string
	fileSize: number
	mimeType: string
}

export interface GLTFAssetData {
	fileName: string
	data: Uint8Array
	mimeType: string
	type: 'buffer' | 'image'
}

const db = getDbClient()
const ASSET_FOLDER_NAME = 'Scene Assets'
const DEFAULT_MIME_TYPE = 'application/octet-stream'
const STORAGE_BUCKET = 'assets'
let ensureBucketPromise: Promise<void> | null = null

/**
 * Returns a Supabase client authenticated with the service role key.
 * The service role bypasses RLS — all permission checks happen at the route layer.
 */
function getStorageClient() {
	const supabaseUrl = process.env.SUPABASE_URL?.trim()
	const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()

	if (!supabaseUrl || !secretKey) {
		throw new Error(
			'Missing required environment variables: SUPABASE_URL and SUPABASE_SECRET_KEY must be set'
		)
	}

	return createClient(supabaseUrl, secretKey, {
		auth: { persistSession: false }
	}).storage
}

/**
 * Ensures the storage bucket exists before any object operations.
 * This keeps storage setup out of ad-hoc SQL migrations.
 */
async function ensureStorageBucket() {
	const storage = getStorageClient()

	const { data: bucket, error: getBucketError } =
		await storage.getBucket(STORAGE_BUCKET)

	if (getBucketError && getBucketError.message !== 'Bucket not found') {
		throw new Error(
			`Failed to inspect storage bucket: ${getBucketError.message}`
		)
	}

	if (!bucket) {
		const { error: createBucketError } = await storage.createBucket(
			STORAGE_BUCKET,
			{
				public: false,
				fileSizeLimit: 104857600
			}
		)

		if (
			createBucketError &&
			!createBucketError.message.toLowerCase().includes('already exists')
		) {
			throw new Error(
				`Failed to create storage bucket ${STORAGE_BUCKET}: ${createBucketError.message}`
			)
		}
	}
}

async function ensureStorageBucketOnce() {
	if (!ensureBucketPromise) {
		ensureBucketPromise = ensureStorageBucket().catch((error) => {
			ensureBucketPromise = null
			throw error
		})
	}

	await ensureBucketPromise
}

/**
 * Ensures the project has a dedicated folder record for scene assets and
 * returns that folder. Reuses the existing row when present.
 */
async function ensureAssetFolder(projectId: string) {
	const existingFolder = await db
		.select()
		.from(folders)
		.where(
			and(eq(folders.projectId, projectId), eq(folders.name, ASSET_FOLDER_NAME))
		)
		.limit(1)

	if (existingFolder.length > 0) {
		return existingFolder[0]
	}

	const folderId = randomUUID()
	const folderResult = await db
		.insert(folders)
		.values({
			id: folderId,
			name: ASSET_FOLDER_NAME,
			projectId,
			parentFolderId: null
		})
		.returning()

	return folderResult[0]
}

/**
 * How many same-bytes rows to consider before giving up on reuse. Duplicates
 * are the pathology this lookup exists to stop creating, so the list is short
 * by design.
 */
const REUSE_CANDIDATE_LIMIT = 25

/**
 * Computes a deterministic content hash used for de-duplication.
 */
export function computeAssetHash(data: Uint8Array): string {
	return createHash('sha256').update(data).digest('hex')
}

/**
 * Finds an already-uploaded asset in this project's folder holding these exact
 * bytes, which some scene already references.
 *
 * Two rules, and both are load-bearing.
 *
 * The content hash is the identity, so it belongs in the predicate. Matching on
 * `(folderId, name)` and checking the hash afterwards looks equivalent but is
 * not: the asset folder is one per project, so every scene writes `scene.gltf`
 * and `scene-thumbnail.webp` into it. Once two rows share a name, an unordered
 * `limit(1)` returns an arbitrary one, the hash check fails against a row that
 * was never the right candidate, and another duplicate is written - which makes
 * the next lookup likelier to miss. That is how one folder came to hold 103
 * rows named `scene.gltf`.
 *
 * An unreferenced row is never reused, even when its bytes match. Such a row
 * belongs to an upload batch that has not committed yet, and handing it to a
 * second batch puts one row under two owners: whichever batch fails first
 * reclaims it, deleting an asset the other is about to link, and because
 * `scene_assets.asset_id` cascades the loser can end up returning success with
 * its glTF silently unlinked. No grace window fixes that, because the two
 * batches overlap for as long as the slower one takes. Sharing only what is
 * already referenced removes that case: a referenced row is one
 * `selectUnreferencedAssetIds` will never let anything delete.
 *
 * It narrows rather than eliminates. A row referenced when it is handed out can
 * lose its last reference before the reusing batch commits - re-save the scene
 * that held it, or delete that scene - and then it is collectable again. That
 * window needs a concurrent unlink of the same asset and costs a failed save
 * that succeeds on retry, where the shared-in-flight case cost a silently
 * unlinked scene. Closing it needs the reuse to take a reference rather than
 * observe one, which is a schema change and is filed, not done here.
 *
 * The cost is a duplicate row when two saves upload identical new bytes at the
 * same time, which is rare and self-correcting. The common case - re-saving a
 * scene whose assets are already linked - still deduplicates.
 */
async function findExistingAsset(
	hash: string,
	fileName: string,
	folderId: string
): Promise<typeof assets.$inferSelect | null> {
	const matches = await db
		.select()
		.from(assets)
		.where(
			and(
				eq(assets.folderId, folderId),
				eq(assets.name, fileName),
				sql`${assets.metadata}->>'contentHash' = ${hash}`
			)
		)
		.orderBy(desc(assets.createdAt))
		.limit(REUSE_CANDIDATE_LIMIT)

	if (matches.length === 0) return null

	const unreferenced = new Set(
		await selectUnreferencedAssetIds(matches.map((asset) => asset.id))
	)

	return matches.find((asset) => !unreferenced.has(asset.id)) ?? null
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message
	}

	return String(error)
}

/**
 * Uploads extracted GLTF assets for a scene and persists asset metadata.
 *
 * Existing assets are reused when filename + content hash match, so repeated
 * saves avoid unnecessary uploads.
 */
export async function uploadSceneAssets(
	sceneId: string,
	userId: string,
	projectId: string,
	gltfAssets: GLTFAssetData[]
): Promise<AssetUploadResult[]> {
	await ensureStorageBucketOnce()

	const storage = getStorageClient()
	const folder = await ensureAssetFolder(projectId)
	const results: AssetUploadResult[] = []

	for (const asset of gltfAssets) {
		const contentHash = computeAssetHash(asset.data)
		const fileName = asset.fileName

		// Reuse already uploaded project asset when bytes are unchanged.
		const existingAsset = await findExistingAsset(
			contentHash,
			fileName,
			folder.id
		)

		if (existingAsset) {
			results.push({
				assetId: existingAsset.id,
				fileName: existingAsset.name,
				filePath: existingAsset.filePath,
				fileSize: existingAsset.fileSize || asset.data.byteLength,
				mimeType: existingAsset.mimeType || asset.mimeType
			})
			continue
		}

		const assetId = randomUUID()
		const filePath = `scenes/${sceneId}/assets/${assetId}/${fileName}`

		try {
			// Upload first, then persist DB row to avoid dangling records.
			const { error: uploadError } = await storage
				.from(STORAGE_BUCKET)
				.upload(filePath, asset.data, {
					contentType: asset.mimeType,
					upsert: false
				})

			if (uploadError) {
				throw new Error(uploadError.message)
			}

			await db.insert(assets).values({
				id: assetId,
				folderId: folder.id,
				name: fileName,
				type: asset.type === 'image' ? 'texture' : 'model',
				filePath,
				fileSize: asset.data.byteLength,
				mimeType: asset.mimeType,
				metadata: {
					sceneId,
					originalFileName: fileName,
					assetType: asset.type,
					contentHash
				},
				ownerId: userId
			})

			results.push({
				assetId,
				fileName,
				filePath,
				fileSize: asset.data.byteLength,
				mimeType: asset.mimeType
			})
		} catch (error) {
			throw new Error(
				`Failed to upload asset ${fileName}: ${getErrorMessage(error)}`,
				error instanceof Error ? { cause: error } : undefined
			)
		}
	}

	return results
}

/**
 * Downloads a single asset payload and returns bytes + metadata for response use.
 */
export async function downloadAsset(assetId: string): Promise<{
	data: Uint8Array
	mimeType: string
	fileName: string
}> {
	await ensureStorageBucketOnce()

	const [asset] = await db
		.select()
		.from(assets)
		.where(eq(assets.id, assetId))
		.limit(1)

	if (!asset) {
		throw new Error(`Asset not found: ${assetId}`)
	}

	const storage = getStorageClient()

	try {
		const { data, error } = await storage
			.from(STORAGE_BUCKET)
			.download(asset.filePath)

		if (error) {
			throw new Error(error.message)
		}

		return {
			data: new Uint8Array(await data.arrayBuffer()),
			mimeType: asset.mimeType || DEFAULT_MIME_TYPE,
			fileName: asset.name
		}
	} catch (error) {
		throw new Error(
			`Failed to download asset ${assetId}: ${getErrorMessage(error)}`,
			error instanceof Error ? { cause: error } : undefined
		)
	}
}

/**
 * Best-effort bulk download helper.
 *
 * Failed items are logged and skipped so callers can continue with successful
 * assets instead of failing the full batch.
 */
export async function downloadAssets(
	assetIds: string[]
): Promise<SceneAssetBinaryDataMap> {
	const results: SceneAssetBinaryDataMap = new Map()

	const downloads = assetIds.map(async (assetId) => {
		const assetData = await downloadAsset(assetId)
		return { assetId, assetData }
	})

	const settled = await Promise.allSettled(downloads)
	for (const [index, outcome] of settled.entries()) {
		const assetId = assetIds[index]

		if (outcome.status === 'fulfilled') {
			results.set(outcome.value.assetId, outcome.value.assetData)
			continue
		}

		// Dropped from the results rather than failing the batch, so the caller
		// gets a short list and no indication that it is short.
		reportServerError(outcome.reason, { properties: { assetId } })
	}

	return results
}

/**
 * Deletes assets from both storage and database records.
 *
 * Missing assets are treated as non-fatal and logged as warnings.
 */

/**
 * Narrows a set of asset ids to the ones nothing points at any more.
 *
 * There are three ways an asset is still in use, and every caller that deletes
 * assets has to respect all of them:
 *
 *  1. `scene_assets` - anything a scene's settings link to.
 *  2. `scene_published` - the live GLB.
 *  3. `scenes.thumbnail_url` - the scene thumbnail.
 *
 * The third is the one that bit us. A thumbnail is referenced by a *URL* rather
 * than a foreign key, so it joins to nothing, and the save-path GC only ever
 * asked `scene_assets`. A save unlinks the thumbnail from the scene's asset set,
 * the GC finds no remaining `scene_assets` row, and deletes the file that
 * `thumbnail_url` still points at - which is why a freshly published scene lost
 * its thumbnail. Some thumbnails are not in `scene_assets` at all, so for those
 * a single GC pass was enough to lose them.
 *
 * Uploads are content-addressed and reused, so an asset is frequently shared;
 * this must run *after* the rows that reference it are gone, and anything still
 * pointing at it belongs to somebody else.
 */
export async function selectUnreferencedAssetIds(
	assetIds: string[]
): Promise<string[]> {
	if (assetIds.length === 0) {
		return []
	}

	// The id is the last path segment of `/api/scenes/:sceneId/thumbnail/:assetId`.
	const thumbnailAssetId = sql<string>`regexp_replace(${scenes.thumbnailUrl}, '^.*/', '')`

	const [attached, published, thumbnails] = await Promise.all([
		db
			.selectDistinct({ assetId: sceneAssets.assetId })
			.from(sceneAssets)
			.where(inArray(sceneAssets.assetId, assetIds)),
		db
			.selectDistinct({ assetId: scenePublished.assetId })
			.from(scenePublished)
			.where(inArray(scenePublished.assetId, assetIds)),
		db
			.select({ assetId: thumbnailAssetId })
			.from(scenes)
			.where(
				and(isNotNull(scenes.thumbnailUrl), inArray(thumbnailAssetId, assetIds))
			)
	])

	const referenced = new Set([
		...attached.map((row) => row.assetId),
		...published.map((row) => row.assetId),
		...thumbnails.map((row) => row.assetId)
	])

	return assetIds.filter((assetId) => !referenced.has(assetId))
}

export async function deleteAssets(assetIds: string[]): Promise<void> {
	await ensureStorageBucketOnce()

	const storage = getStorageClient()

	for (const assetId of assetIds) {
		try {
			const [asset] = await db
				.select()
				.from(assets)
				.where(eq(assets.id, assetId))
				.limit(1)

			if (!asset) {
				console.warn(`Asset not found in database: ${assetId}`)
				continue
			}

			const { error } = await storage
				.from(STORAGE_BUCKET)
				.remove([asset.filePath])

			if (error) {
				// File already gone from storage — still clean up the DB record.
				if (/not found/i.test(error.message)) {
					console.warn(
						`Storage file not found for asset ${assetId}, removing DB record only`
					)
				} else {
					throw new Error(error.message)
				}
			}

			await db.delete(assets).where(eq(assets.id, assetId))
		} catch (error) {
			reportServerError(error, { properties: { assetId } })
		}
	}
}
