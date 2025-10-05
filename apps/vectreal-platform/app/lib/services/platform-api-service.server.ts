import type { Bucket } from '@google-cloud/storage'

import type { ApiUserContext } from '../../types/api'
import { ApiResponseBuilder } from '../api/api-responses'
import { createClient } from '../supabase.server'

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
		request: Request
	): Promise<ApiUserContext | Response> {
		const { client, headers } = await createClient(request)
		const user = (await client.auth.getUser()).data.user

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
		readonly sceneId?: string
		readonly fileName: string
		readonly kind: 'asset' | 'thumbnail'
	}): string {
		const { userId, sceneId, fileName, kind } = params

		const userPrefix = `user/${userId}`
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
