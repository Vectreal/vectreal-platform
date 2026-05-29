/* vectreal-platform | API Route
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>. */

import { ApiResponse } from '@shared/utils'
import { TextureCompressOptions } from '@vctrl/core'
import { data } from 'react-router'

import { Route } from './+types/optimize-textures'
import {
	getOrgSubscription,
	getRecommendedUpgrade
} from '../../lib/domain/billing/entitlement-service.server'
import {
	checkQuota,
	type UsageCheckResult
} from '../../lib/domain/billing/usage-service.server'
import { initializeUserDefaults } from '../../lib/domain/user/user-repository.server'
import { getAuthUser } from '../../lib/http/auth.server'
import { ensureSameOriginMutation } from '../../lib/http/csrf.server'
import { ensurePost } from '../../lib/http/requests.server'
import {
	getGuestOptimizeQuotaSession,
	readGuestOptimizeQuotaSnapshot
} from '../../lib/sessions/guest-optimize-quota-session.server'

const mimeTypeToExtension = (mimeType: string): string | null => {
	switch (mimeType.toLowerCase()) {
		case 'image/webp':
			return 'webp'
		case 'image/jpeg':
			return 'jpg'
		case 'image/png':
			return 'png'
		default:
			return null
	}
}

const replaceFileExtension = (fileName: string, extension: string): string => {
	const queryIndex = fileName.indexOf('?')
	const hashIndex = fileName.indexOf('#')
	const suffixStart = [queryIndex, hashIndex]
		.filter((index) => index >= 0)
		.reduce((min, index) => Math.min(min, index), Number.POSITIVE_INFINITY)
	const hasSuffix = Number.isFinite(suffixStart)
	const base = hasSuffix ? fileName.slice(0, suffixStart) : fileName
	const suffix = hasSuffix ? fileName.slice(suffixStart) : ''
	const lastSlash = base.lastIndexOf('/')
	const lastDot = base.lastIndexOf('.')
	const hasExtension = lastDot > lastSlash
	const nextBase = hasExtension
		? `${base.slice(0, lastDot)}.${extension}`
		: `${base}.${extension}`

	return `${nextBase}${suffix}`
}

const resolveCanonicalTextureFileName = (
	fileName: string,
	mimeType: string
): string => {
	const fileNameOnly = extractTextureFileName(fileName)
	const extension = mimeTypeToExtension(mimeType)
	if (!extension) {
		return fileNameOnly
	}

	return replaceFileExtension(fileNameOnly, extension)
}

const extractTextureFileName = (value: string): string => {
	const withoutQuery = value.split('?')[0] || value
	const withoutHash = withoutQuery.split('#')[0] || withoutQuery
	const normalized = withoutHash.replace(/\\/g, '/').trim()
	return normalized.split('/').pop() || normalized
}

const GENERIC_TEXTURE_FILE_NAME_PATTERN =
	/^(?:text{1,2}ure|image|img)[-_ ]?\d+(?:\.[a-z0-9]+)?$/i

const isGenericTextureFileName = (value: string): boolean => {
	const trimmed = value.trim()
	if (trimmed.length === 0) {
		return false
	}

	return GENERIC_TEXTURE_FILE_NAME_PATTERN.test(extractTextureFileName(trimmed))
}

/**
 * Invokes the optimize-textures Supabase Edge Function.
 *
 * The function URL is derived from SUPABASE_URL so no additional env vars
 * are needed beyond what the app already requires for Supabase connectivity.
 */
async function invokeOptimizeTexturesFunction(params: {
	inputBuffer: Uint8Array
	textureIndex: number
	textureName: string
	optionsStr: string
}): Promise<Response> {
	const { inputBuffer, textureIndex, textureName, optionsStr } = params

	const supabaseUrl = process.env.SUPABASE_URL?.trim()
	const supabaseKey = process.env.SUPABASE_KEY?.trim()

	if (!supabaseUrl || !supabaseKey) {
		throw new Error(
			'Missing required Supabase environment variables: SUPABASE_URL and SUPABASE_KEY must be set'
		)
	}

	const functionUrl = `${supabaseUrl}/functions/v1/optimize-textures`

	const fnResponse = await fetch(functionUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/octet-stream',
			'Authorization': `Bearer ${supabaseKey}`,
			'X-Texture-Index': String(textureIndex),
			'X-Texture-File-Name': textureName,
			'X-Optimize-Options': optionsStr
		},
		body: inputBuffer
	})

	if (!fnResponse.ok && fnResponse.status !== 400) {
		console.error(
			`[optimize-textures] Edge function returned ${fnResponse.status}`,
			await fnResponse.text().catch(() => '')
		)
	}

	const responseHeaders = new Headers(fnResponse.headers)
	responseHeaders.set('Cache-Control', 'no-store')

	return new Response(fnResponse.body, {
		status: fnResponse.status,
		headers: responseHeaders
	})
}

/**
 * Server-side texture optimization API endpoint.
 *
 * This endpoint focuses specifically on texture compression and optimization
 * using Sharp for high-quality image processing in Node.js environments.
 *
 * Example usage:
 * POST /api/optimize-textures
 * Content-Type: multipart/form-data
 *
 * Body:
 * - texture: image file blob
 * - textureIndex: numeric texture index in source model
 * - textureName: original texture name
 * - options: JSON string with TextureCompressOptions
 */
export async function action({ request }: Route.ActionArgs) {
	const methodCheck = ensurePost(request)
	if (methodCheck) {
		return methodCheck
	}

	const csrfCheck = ensureSameOriginMutation(request)
	if (csrfCheck) {
		return csrfCheck
	}

	// Authenticate the request and enforce plan quota for authenticated users.
	// For guests, allow texture optimization while their daily guest optimization
	// quota window still has remaining capacity (tracked in cookie session).
	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		const guestSession = await getGuestOptimizeQuotaSession(request)
		const guestQuota = readGuestOptimizeQuotaSnapshot(guestSession)
		if (guestQuota.outcome === 'hard_limit_exceeded') {
			return ApiResponse.quotaExceeded(
				'You have reached the free guest optimization limit for today. Sign in to continue with plan-based quotas.',
				{
					limitKey: 'optimization_runs_per_month',
					currentValue: guestQuota.currentValue,
					limit: guestQuota.limit,
					plan: 'free',
					upgradeTo: 'pro'
				}
			)
		}
	} else {
		let organizationId: string
		try {
			const userDefaults = await initializeUserDefaults(authResult.user)
			organizationId = userDefaults.organization.id
		} catch {
			return ApiResponse.serverError('Failed to resolve organization')
		}

		const quotaCheck: UsageCheckResult = await checkQuota(
			organizationId,
			'optimization_runs_per_month'
		)

		if (quotaCheck.outcome === 'hard_limit_exceeded') {
			const { plan } = await getOrgSubscription(organizationId)
			const upgradeTo = getRecommendedUpgrade(plan)
			return ApiResponse.quotaExceeded(
				'Monthly optimization limit reached. Upgrade your plan to continue optimizing.',
				{
					limitKey: 'optimization_runs_per_month',
					currentValue: quotaCheck.currentValue,
					limit: quotaCheck.limit,
					plan,
					upgradeTo
				}
			)
		}
	}

	try {
		const contentType = request.headers.get('content-type') || ''
		if (!contentType.includes('application/octet-stream')) {
			return data(
				{
					error:
						'Unsupported content type. optimize-textures requires application/octet-stream payloads.'
				},
				{ status: 415, headers: { 'Cache-Control': 'no-store' } }
			)
		}

		const textureIndexRaw = request.headers.get('x-texture-index')
		const textureNameRaw =
			request.headers.get('x-texture-file-name') ||
			request.headers.get('x-texture-name')
		const optionsStr = request.headers.get('x-optimize-options') || ''
		const textureIndex =
			typeof textureIndexRaw === 'string'
				? Number.parseInt(textureIndexRaw, 10)
				: Number.NaN
		const textureName =
			typeof textureNameRaw === 'string' ? textureNameRaw.trim() : ''

		if (!Number.isFinite(textureIndex) || textureIndex < 0) {
			return data(
				{ error: 'Invalid or missing textureIndex' },
				{ status: 400, headers: { 'Cache-Control': 'no-store' } }
			)
		}

		if (textureName.length === 0) {
			return data(
				{ error: 'Missing canonical texture file name' },
				{ status: 400, headers: { 'Cache-Control': 'no-store' } }
			)
		}

		if (isGenericTextureFileName(textureName)) {
			console.warn('[optimize-textures] Received generic texture file name', {
				textureIndex,
				textureName
			})
		}

		let options: TextureCompressOptions = {
			resize: [2048, 2048],
			quality: 80,
			targetFormat: 'webp'
		}

		if (optionsStr) {
			try {
				options = JSON.parse(optionsStr)
			} catch {
				return data(
					{ error: 'Invalid options JSON format' },
					{ status: 400, headers: { 'Cache-Control': 'no-store' } }
				)
			}
		}

		const requestBuffer = await request.arrayBuffer()
		if (!requestBuffer.byteLength) {
			return data(
				{ error: 'Texture payload is empty' },
				{ status: 400, headers: { 'Cache-Control': 'no-store' } }
			)
		}

		return await invokeOptimizeTexturesFunction({
			inputBuffer: new Uint8Array(requestBuffer),
			textureIndex,
			textureName,
			optionsStr
		})
	} catch (error) {
		console.error('[optimize-textures] Request failed:', error)

		const errorMessage =
			error instanceof Error ? error.message : 'Texture optimization failed'

		return data(
			{
				error: errorMessage,
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500, headers: { 'Cache-Control': 'no-store' } }
		)
	}
}
