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

let bucketCache: { public: Bucket; private: Bucket } | null = null

async function getBuckets() {
	if (!bucketCache) {
		const storage = await createStorage()
		bucketCache = {
			public: storage.public,
			private: storage.private
		}
	}
	return bucketCache
}

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

async function uploadToGCS(
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

export function computeAssetHash(data: Uint8Array): string {
	return createHash('sha256').update(data).digest('hex')
}

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
