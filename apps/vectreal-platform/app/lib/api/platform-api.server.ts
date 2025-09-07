import { randomUUID as uuidv4 } from 'crypto'

import type { Bucket } from '@google-cloud/storage'

import { getDbClient } from '../../db/client'
import { assets } from '../../db/schema/project/assets'
import { folders } from '../../db/schema/project/folders'
import { createClient } from '../supabase.server'

import type { ApiUserContext } from '../types/api'
import { ApiResponseBuilder } from '../utils/api-responses'

/**
 * Platform API service for common server operations.
 * Follows the Google TypeScript style guide for class organization.
 */
export class PlatformApiService {
	/**
	 * Ensures the request method is POST.
	 * @param request - The HTTP request
	 * @returns Error response if not POST, null otherwise
	 */
	static ensurePost(request: Request): Response | null {
		if (request.method !== 'POST') {
			return ApiResponseBuilder.methodNotAllowed()
		}
		return null
	}

	/**
	 * Gets authenticated user from request.
	 * @param request - The HTTP request
	 * @param options - Authentication options
	 * @returns User context or error response
	 */
	static async getAuthUser(
		request: Request,
		options: { allowAnonymous?: boolean } = {}
	): Promise<ApiUserContext | Response> {
		const { client, headers } = await createClient(request)
		let user = (await client.auth.getUser()).data.user

		if (!user && options.allowAnonymous) {
			const { data: authData, error } = await client.auth.signInAnonymously()

			if (error || !authData.user) {
				return ApiResponseBuilder.serverError(
					'Failed to create anonymous session'
				)
			}

			user = authData.user
		}

		if (!user) {
			return ApiResponseBuilder.unauthorized()
		}

		return { user, headers }
	}

	/**
	 * Parses request body content regardless of content type.
	 * Supports JSON, FormData, and URL-encoded data.
	 * @param request - The HTTP request
	 * @returns Parsed request data
	 */
	static async parseActionRequest(
		request: Request
	): Promise<Record<string, unknown>> {
		const contentType = request.headers.get('content-type') || ''

		try {
			if (contentType.includes('application/json')) {
				return await request.json()
			}

			if (
				contentType.includes('multipart/form-data') ||
				contentType.includes('application/x-www-form-urlencoded')
			) {
				const form = await request.formData()
				const obj: Record<string, FormDataEntryValue> = {}
				for (const [k, v] of form.entries()) {
					obj[k] = v
				}
				return obj
			}

			// Fallback to JSON parsing
			return await request.json()
		} catch (error) {
			console.warn('Failed to parse request body:', error)
			return {}
		}
	}

	/**
	 * Builds a structured Google Cloud Storage file path.
	 * @param params - Path building parameters
	 * @returns Structured file path
	 */
	static buildStoragePath(params: {
		readonly userId: string
		readonly isAnonymous: boolean
		readonly sceneId?: string
		readonly fileName: string
		readonly kind: 'asset' | 'thumbnail'
	}): string {
		const { userId, isAnonymous, sceneId, fileName, kind } = params

		const userPrefix = isAnonymous ? `anon/${userId}` : `user/${userId}`
		const scenePrefix = sceneId ? `scenes/${sceneId}` : 'global'

		return `${userPrefix}/${scenePrefix}/${kind}/${fileName}`
	}

	/**
	 * Saves base64 content to a Google Cloud Storage bucket.
	 * @param params - File saving parameters
	 * @returns Promise that resolves when file is saved
	 */
	static async saveBase64File(params: {
		readonly bucket: Bucket
		readonly base64: string
		readonly path: string
		readonly contentType: string
		readonly metadata?: Record<string, string>
	}): Promise<void> {
		const { bucket, base64, path, contentType, metadata } = params

		const file = bucket.file(path)
		const buffer = Buffer.from(base64, 'base64')

		await file.save(buffer, {
			metadata: {
				contentType,
				metadata: metadata || {}
			}
		})
	}

	/**
	 * Determines asset type from filename or MIME type.
	 * @param fileName - Name of the file
	 * @param mimeType - MIME type of the file
	 * @returns Asset type classification
	 */
	static determineAssetType(
		fileName: string,
		mimeType?: string
	): 'model' | 'texture' | 'other' {
		const extension = fileName.split('.').pop()?.toLowerCase()

		const modelExtensions = ['gltf', 'glb', 'fbx', 'obj', 'dae']
		const textureExtensions = ['jpg', 'jpeg', 'png', 'webp', 'exr', 'hdr']

		if (extension && modelExtensions.includes(extension)) {
			return 'model'
		}

		if (extension && textureExtensions.includes(extension)) {
			return 'texture'
		}

		if (mimeType) {
			if (mimeType.startsWith('model/')) return 'model'
			if (mimeType.startsWith('image/')) return 'texture'
		}

		return 'other'
	}
}

// Legacy exports for backward compatibility
export const ensurePost = PlatformApiService.ensurePost
export const getAuthUser = PlatformApiService.getAuthUser
export const parseActionRequest = PlatformApiService.parseActionRequest
export const buildStoragePath = PlatformApiService.buildStoragePath
export const saveBase64File = PlatformApiService.saveBase64File
export const determineAssetType = PlatformApiService.determineAssetType

/**
 * Creates an "Assets" folder for a project if it doesn't exist.
 * @param projectId - The project ID
 * @returns The assets folder record
 */
export async function ensureAssetsFolder(projectId: string) {
	const db = getDbClient()
	let folder = await db.query.folders.findFirst({
		where: (f, { and, eq }) =>
			and(eq(f.projectId, projectId), eq(f.name, 'Assets'))
	})

	if (!folder) {
		const id = uuidv4()
		await db.insert(folders).values({ id, name: 'Assets', projectId })
		folder = { id, name: 'Assets', projectId, parentFolderId: null }
	}

	return folder
}

/**
 * Inserts an asset record into the database.
 * @param params - Asset insertion parameters
 * @returns The created asset ID
 */
export async function insertAsset(params: {
	readonly folderId: string
	readonly fileName: string
	readonly filePath: string
	readonly fileSize: number
	readonly mimeType: string
	readonly ownerId: string
	readonly sceneId: string
	readonly isMainFile: boolean
	readonly relatedTo?: string
}): Promise<string> {
	const {
		folderId,
		fileName,
		filePath,
		fileSize,
		mimeType,
		ownerId,
		sceneId,
		isMainFile,
		relatedTo
	} = params

	const db = getDbClient()
	const id = uuidv4()

	await db.insert(assets).values({
		id,
		folderId,
		name: fileName,
		type: PlatformApiService.determineAssetType(fileName, mimeType),
		filePath,
		fileSize,
		mimeType,
		ownerId,
		metadata: {
			publicUrl: `https://storage.googleapis.com/${
				process.env.GOOGLE_CLOUD_STORAGE_PUBLIC_BUCKET ||
				'vectreal-public-bucket'
			}/${filePath}`,
			isMainFile,
			sceneId,
			...(relatedTo ? { relatedToMainFile: relatedTo } : {})
		}
	})

	return id
}

/**
 * Fetches a scene by ID ensuring it exists.
 * @param sceneId - The scene ID to fetch
 * @returns The scene record or undefined if not found
 */
export async function getScene(sceneId: string) {
	const db = getDbClient()
	return db.query.scenes.findFirst({
		where: (s, { eq }) => eq(s.id, sceneId)
	})
}
