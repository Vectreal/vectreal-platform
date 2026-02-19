import { randomUUID } from 'crypto'
import { createHash } from 'node:crypto'

import type { Bucket } from '@google-cloud/storage'
import { and, eq } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { assets, folders } from '../../../db/schema'
import { createStorage } from '../../gcloud-storage.server'

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

/**
 * Returns fresh bucket handles for each operation.
 *
 * Avoiding long-lived cached instances helps prevent stream lifecycle issues
 * observed in production during multi-file uploads.
 */
async function getBuckets() {
	const storage = await createStorage()
	return {
		public: storage.public,
		private: storage.private
	}
}

/**
 * Ensures the project has a dedicated folder record for scene assets and
 * returns that folder. Reuses the existing row when present.
 */
async function ensureAssetFolder(projectId: string) {
	const folderName = 'Scene Assets'
	const existingFolder = await db
		.select()
		.from(folders)
		.where(eq(folders.projectId, projectId))
		.limit(1)

	if (existingFolder.length > 0) {
		return existingFolder[0]
	}

	const folderId = randomUUID()
	const folderResult = await db
		.insert(folders)
		.values({
			id: folderId,
			name: folderName,
			projectId,
			parentFolderId: null
		})
		.returning()

	return folderResult[0]
}

/**
 * Uploads raw bytes to Google Cloud Storage with retry/backoff for transient
 * transport errors.
 *
 * - Small files use non-resumable uploads for lower overhead.
 * - Larger files use resumable uploads for better reliability.
 */
async function uploadToGCS(
	bucket: Bucket,
	filePath: string,
	data: Uint8Array,
	mimeType: string
): Promise<void> {
	const maxRetries = 3
	const resumableThresholdBytes = 5 * 1024 * 1024 // 5MB is a common threshold for when to use resumable uploads
	const shouldUseResumable = data.byteLength >= resumableThresholdBytes

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const file = bucket.file(filePath)

			await file.save(Buffer.from(data), {
				metadata: {
					contentType: mimeType
				},
				resumable: shouldUseResumable
			})

			return
		} catch (error) {
			if (!isRetryableUploadError(error) || attempt === maxRetries) {
				throw error
			}

			const backoffMs = 1000 * 2 ** (attempt - 1)
			console.warn(
				`Retrying upload for ${filePath} after attempt ${attempt}/${maxRetries} due to transient error`
			)
			await delay(backoffMs)
		}
	}
}

/**
 * Detects transient upload failures that are typically safe to retry.
 */
function isRetryableUploadError(error: unknown): boolean {
	const message =
		error instanceof Error
			? error.message.toLowerCase()
			: String(error).toLowerCase()

	return (
		message.includes('stream was destroyed') ||
		message.includes('cannot call write after a stream was destroyed') ||
		message.includes('econnreset') ||
		message.includes('etimedout') ||
		message.includes('socket hang up') ||
		message.includes('timeout')
	)
}

/**
 * Simple async delay utility used by exponential backoff retries.
 */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
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
	projectId: string
): Promise<typeof assets.$inferSelect | null> {
	const folder = await ensureAssetFolder(projectId)

	const existingAssets = await db
		.select()
		.from(assets)
		.where(and(eq(assets.folderId, folder.id), eq(assets.name, fileName)))
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
	const { private: privateBucket } = await getBuckets()
	const folder = await ensureAssetFolder(projectId)
	const results: AssetUploadResult[] = []

	for (const asset of gltfAssets) {
		const contentHash = computeAssetHash(asset.data)
		const fileName = asset.fileName

		// Reuse already uploaded project asset when bytes are unchanged.
		const existingAsset = await findExistingAsset(
			contentHash,
			fileName,
			projectId
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
			await uploadToGCS(privateBucket, filePath, asset.data, asset.mimeType)

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
			throw new Error(`Failed to upload asset ${fileName}: ${error}`)
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
	const [asset] = await db
		.select()
		.from(assets)
		.where(eq(assets.id, assetId))
		.limit(1)

	if (!asset) {
		throw new Error(`Asset not found: ${assetId}`)
	}

	const { private: privateBucket } = await getBuckets()
	const file = privateBucket.file(asset.filePath)

	try {
		const [buffer] = await file.download()

		return {
			data: new Uint8Array(buffer),
			mimeType: asset.mimeType || 'application/octet-stream',
			fileName: asset.name
		}
	} catch (error) {
		console.error(`Failed to download asset ${assetId}:`, error)
		throw new Error(`Failed to download asset ${assetId}: ${error}`)
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
): Promise<
	Map<string, { data: Uint8Array; mimeType: string; fileName: string }>
> {
	const results = new Map()

	const downloads = assetIds.map(async (assetId) => {
		try {
			const assetData = await downloadAsset(assetId)
			return { assetId, assetData }
		} catch (error) {
			throw new Error(`Failed to download asset ${assetId}: ${error}`)
		}
	})

	const settled = await Promise.allSettled(downloads)
	for (const outcome of settled) {
		if (outcome.status === 'fulfilled') {
			results.set(outcome.value.assetId, outcome.value.assetData)
			continue
		}
		const reason = outcome.reason as { assetId?: string; error?: unknown }
		const assetId = reason?.assetId || 'unknown'
		console.error(`Failed to download asset ${assetId}:`, reason?.error)
	}

	return results
}

/**
 * Deletes assets from both storage and database records.
 *
 * Missing assets are treated as non-fatal and logged as warnings.
 */
export async function deleteAssets(assetIds: string[]): Promise<void> {
	const { private: privateBucket } = await getBuckets()

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

			const file = privateBucket.file(asset.filePath)
			await file.delete()

			await db.delete(assets).where(eq(assets.id, assetId))
		} catch (error) {
			console.error(`Failed to delete asset ${assetId}:`, error)
		}
	}
}
