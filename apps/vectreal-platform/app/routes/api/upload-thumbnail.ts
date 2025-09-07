import { eq } from 'drizzle-orm'
import { data } from 'react-router'

import { getDbClient } from '../../db/client'
import { scenes } from '../../db/schema/project/scenes'
import { createStorage } from '../../lib/gcloud-storage.server'
import { createClient } from '../../lib/supabase.server'

import { Route } from './+types/upload-thumbnail'

interface ThumbnailUploadRequest {
	sceneId: string
	thumbnailData: string // base64 encoded image
	mimeType?: string
}

/**
 * Generate thumbnail file path for cloud storage
 */
function generateThumbnailPath(
	userId: string,
	sceneId: string,
	isAnonymous: boolean
): string {
	const prefix = process.env.NODE_ENV === 'development' ? 'dev' : 'prod'
	const userType = isAnonymous ? 'anonymous' : 'authenticated'
	const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD

	// Structure: {env}/{userType}/{userId}/thumbnails/{sceneId}/{timestamp}/thumbnail.jpg
	return `${prefix}/${userType}/${userId}/thumbnails/${sceneId}/${timestamp}/thumbnail.jpg`
}

export async function action({ request }: Route.ActionArgs) {
	if (request.method !== 'POST') {
		return data({ error: 'Method not allowed' }, { status: 405 })
	}

	const db = getDbClient()

	try {
		const {
			sceneId,
			thumbnailData,
			mimeType = 'image/jpeg'
		} = (await request.json()) as ThumbnailUploadRequest

		const { client } = await createClient(request)
		const { data: userData } = await client.auth.getUser()

		if (!userData.user) {
			return data({ error: 'Authentication required' }, { status: 401 })
		}

		const user = userData.user

		// Verify scene belongs to user
		const scene = await db.query.scenes.findFirst({
			where: (scenes, { eq }) => eq(scenes.id, sceneId),
			with: {
				project: {
					with: {
						organization: true
					}
				}
			}
		})

		if (!scene) {
			return data({ error: 'Scene not found' }, { status: 404 })
		}

		// Initialize Google Cloud Storage
		const { public: publicBucket } = await createStorage()

		// Generate thumbnail path
		const thumbnailPath = generateThumbnailPath(
			user.id,
			sceneId,
			user.is_anonymous || false
		)

		// Convert base64 to buffer
		// Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
		const base64Data = thumbnailData.includes(',')
			? thumbnailData.split(',')[1]
			: thumbnailData
		const thumbnailBuffer = Buffer.from(base64Data, 'base64')

		// Upload thumbnail to cloud storage
		const thumbnailFile = publicBucket.file(thumbnailPath)
		await thumbnailFile.save(thumbnailBuffer, {
			metadata: {
				contentType: mimeType,
				cacheControl: 'public, max-age=86400', // 24 hours
				metadata: {
					userId: user.id,
					sceneId: sceneId,
					uploadedAt: new Date().toISOString(),
					isAnonymous: (user.is_anonymous || false).toString(),
					fileType: 'thumbnail'
				}
			}
		})

		const thumbnailPublicUrl = `https://storage.googleapis.com/${publicBucket.name}/${thumbnailPath}`

		await db
			.update(scenes)
			.set({
				thumbnailUrl: thumbnailPublicUrl,
				thumbnailPath: thumbnailPath,
				updatedAt: new Date()
			})
			.where(eq(scenes.id, sceneId))

		return data({
			success: true,
			thumbnailUrl: thumbnailPublicUrl,
			thumbnailPath: thumbnailPath,
			message: 'Thumbnail uploaded successfully'
		})
	} catch (error) {
		console.error('Error uploading thumbnail:', error)
		return data({ error: 'Failed to upload thumbnail' }, { status: 500 })
	}
}
