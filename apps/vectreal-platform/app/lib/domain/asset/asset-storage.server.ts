import { randomUUID } from 'crypto'
import { createHash } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import { and, eq } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { assets, folders } from '../../../db/schema'

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
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error(
			'Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
		)
	}

	return createClient(supabaseUrl, serviceRoleKey, {
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
 * Computes a deterministic content hash used for de-duplication.
 */
export function computeAssetHash(data: Uint8Array): string {
	return createHash('sha256').update(data).digest('hex')
}

/**
 * Finds an existing asset with the same project folder + filename and validates
 * it against the content hash stored in metadata.
 */
async function findExistingAsset(
	hash: string,
	fileName: string,
	folderId: string
): Promise<typeof assets.$inferSelect | null> {
	const existingAssets = await db
		.select()
		.from(assets)
		.where(and(eq(assets.folderId, folderId), eq(assets.name, fileName)))
		.limit(1)

	if (existingAssets.length > 0) {
		const asset = existingAssets[0]
		const metadata = asset.metadata as { contentHash?: string } | null
		if (metadata?.contentHash === hash) {
			return asset
		}
	}

	return null
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
			console.error(`Failed to upload asset ${fileName}:`, error)
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
		console.error(`Failed to download asset ${assetId}:`, error)
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

		console.error(
			`Failed to download asset ${assetId}:`,
			getErrorMessage(outcome.reason)
		)
	}

	return results
}

/**
 * Deletes assets from both storage and database records.
 *
 * Missing assets are treated as non-fatal and logged as warnings.
 */
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
			console.error(
				`Failed to delete asset ${assetId}:`,
				getErrorMessage(error)
			)
		}
	}
}
