import { randomUUID } from 'crypto'
import { createHash } from 'node:crypto'

import type { Bucket } from '@google-cloud/storage'
import { and, eq } from 'drizzle-orm'

import { getDbClient } from '../../db/client'
import { assets, folders } from '../../db/schema'
import { createStorage } from '../gcloud-storage.server'

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

/**
 * Service for managing asset storage in Google Cloud Storage and database.
 * Handles uploading, tracking, and retrieving GLTF scene assets.
 */
export class AssetStorageService {
	private db = getDbClient()
	private bucketCache: { public: Bucket; private: Bucket } | null = null

	/**
	 * Get or create Google Cloud Storage buckets.
	 */
	private async getBuckets() {
		if (!this.bucketCache) {
			const storage = await createStorage()
			this.bucketCache = {
				public: storage.public,
				private: storage.private
			}
		}
		return this.bucketCache
	}

	/**
	 * Ensure a project-specific asset folder exists.
	 */
	private async ensureAssetFolder(projectId: string) {
		// Find or create an assets folder for the project
		const folderName = 'Scene Assets'
		const existingFolder = await this.db
			.select()
			.from(folders)
			.where(eq(folders.projectId, projectId))
			.limit(1)

		if (existingFolder.length > 0) {
			return existingFolder[0]
		}

		// Create default asset folder for the project
		const folderId = randomUUID()
		const folderResult = await this.db
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
	 * Upload a single asset to Google Cloud Storage.
	 */
	private async uploadToGCS(
		bucket: Bucket,
		filePath: string,
		data: Uint8Array,
		mimeType: string
	): Promise<void> {
		const file = bucket.file(filePath)

		await file.save(Buffer.from(data), {
			metadata: {
				contentType: mimeType
			},
			resumable: false
		})
	}

	/**
	 * Compute SHA-256 hash of asset data for deduplication.
	 */
	private computeAssetHash(data: Uint8Array): string {
		return createHash('sha256').update(data).digest('hex')
	}

	/**
	 * Find existing asset by hash and filename.
	 */
	private async findExistingAsset(
		hash: string,
		fileName: string,
		projectId: string
	): Promise<typeof assets.$inferSelect | null> {
		const folder = await this.ensureAssetFolder(projectId)

		const existingAssets = await this.db
			.select()
			.from(assets)
			.where(and(eq(assets.folderId, folder.id), eq(assets.name, fileName)))
			.limit(1)

		if (existingAssets.length > 0) {
			const asset = existingAssets[0]
			// Check if the hash matches in metadata
			const metadata = asset.metadata as { contentHash?: string } | null
			if (metadata?.contentHash === hash) {
				return asset
			}
		}

		return null
	}

	/**
	 * Upload GLTF scene assets (buffers and images) to cloud storage.
	 * Reuses existing assets if they already exist (based on content hash).
	 * Creates asset records in the database and returns asset IDs.
	 *
	 * @param sceneId - The scene ID these assets belong to
	 * @param userId - The user ID who owns the assets
	 * @param projectId - The project ID
	 * @param gltfAssets - Array of GLTF asset data to upload
	 * @returns Array of asset upload results with IDs
	 */
	async uploadSceneAssets(
		sceneId: string,
		userId: string,
		projectId: string,
		gltfAssets: GLTFAssetData[]
	): Promise<AssetUploadResult[]> {
		const { private: privateBucket } = await this.getBuckets()
		const folder = await this.ensureAssetFolder(projectId)
		const results: AssetUploadResult[] = []

		for (const asset of gltfAssets) {
			const contentHash = this.computeAssetHash(asset.data)
			const fileName = asset.fileName

			// Check if asset already exists
			const existingAsset = await this.findExistingAsset(
				contentHash,
				fileName,
				projectId
			)

			if (existingAsset) {
				console.log(`Reusing existing asset ${existingAsset.id}: ${fileName}`)
				results.push({
					assetId: existingAsset.id,
					fileName: existingAsset.name,
					filePath: existingAsset.filePath,
					fileSize: existingAsset.fileSize || asset.data.byteLength,
					mimeType: existingAsset.mimeType || asset.mimeType
				})
				continue
			}

			// Asset doesn't exist, create new one
			const assetId = randomUUID()
			const filePath = `scenes/${sceneId}/assets/${assetId}/${fileName}`

			try {
				// Upload to Google Cloud Storage
				await this.uploadToGCS(
					privateBucket,
					filePath,
					asset.data,
					asset.mimeType
				)

				// Create database record with content hash
				await this.db.insert(assets).values({
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

				console.log(`Uploaded new asset ${assetId}: ${fileName}`)
			} catch (error) {
				console.error(`Failed to upload asset ${fileName}:`, error)
				throw new Error(`Failed to upload asset ${fileName}: ${error}`)
			}
		}

		return results
	}

	/**
	 * Download an asset from Google Cloud Storage.
	 *
	 * @param assetId - The asset ID to download
	 * @returns The asset data as Uint8Array
	 */
	async downloadAsset(assetId: string): Promise<{
		data: Uint8Array
		mimeType: string
		fileName: string
	}> {
		// Get asset metadata from database
		const [asset] = await this.db
			.select()
			.from(assets)
			.where(eq(assets.id, assetId))
			.limit(1)

		if (!asset) {
			throw new Error(`Asset not found: ${assetId}`)
		}

		const { private: privateBucket } = await this.getBuckets()
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
	 * Download multiple assets from Google Cloud Storage.
	 *
	 * @param assetIds - Array of asset IDs to download
	 * @returns Map of asset IDs to their data
	 */
	async downloadAssets(
		assetIds: string[]
	): Promise<
		Map<string, { data: Uint8Array; mimeType: string; fileName: string }>
	> {
		const results = new Map()

		for (const assetId of assetIds) {
			try {
				const assetData = await this.downloadAsset(assetId)
				results.set(assetId, assetData)
			} catch (error) {
				console.error(`Failed to download asset ${assetId}:`, error)
				// Continue with other assets even if one fails
			}
		}

		return results
	}

	/**
	 * Delete assets from both cloud storage and database.
	 *
	 * @param assetIds - Array of asset IDs to delete
	 */
	async deleteAssets(assetIds: string[]): Promise<void> {
		const { private: privateBucket } = await this.getBuckets()

		for (const assetId of assetIds) {
			try {
				// Get asset info from database
				const [asset] = await this.db
					.select()
					.from(assets)
					.where(eq(assets.id, assetId))
					.limit(1)

				if (!asset) {
					console.warn(`Asset not found in database: ${assetId}`)
					continue
				}

				// Delete from cloud storage
				const file = privateBucket.file(asset.filePath)
				await file.delete()

				// Delete from database
				await this.db.delete(assets).where(eq(assets.id, assetId))

				console.log(`Deleted asset ${assetId}`)
			} catch (error) {
				console.error(`Failed to delete asset ${assetId}:`, error)
				// Continue with other assets
			}
		}
	}
}

// Singleton instance
export const assetStorageService = new AssetStorageService()
