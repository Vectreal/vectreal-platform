import { ApiResponse } from '@shared/utils'

import { isBillingStateReadOnly } from '../../../constants/plan-config'
import { hasEntitlement } from '../billing/entitlement-service.server'
import { getProject } from '../project/project-repository.server'
import { getOrCreateDefaultOrganization } from '../user/user-repository.server'
import { checkAuthRateLimit } from '../auth/auth-rate-limit.server'
import {
	createTrellisJobToken,
	verifyTrellisJobToken
} from './trellis-job-token.server'
import {
	trellisRuntimeClient,
	TrellisRuntimeError
} from './trellis-runtime-client.server'

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024
const DEFAULT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 3
const DEFAULT_JOB_TOKEN_TTL_MS = 6 * 60 * 60 * 1000

function readPositiveInt(value: string | undefined, fallback: number): number {
	const parsed = Number(value)
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getMaxImageBytes(): number {
	return readPositiveInt(
		process.env.TRELLIS_MAX_IMAGE_BYTES,
		DEFAULT_MAX_IMAGE_BYTES
	)
}

function mapRuntimeError(error: unknown, fallbackMessage: string): Response {
	if (error instanceof TrellisRuntimeError) {
		return ApiResponse.error(error.message, error.status)
	}

	return ApiResponse.serverError(
		error instanceof Error ? error.message : fallbackMessage
	)
}

async function ensureSceneUploadEntitlement(
	userId: string,
	targetProjectId?: string
): Promise<Response | { organizationId: string }> {
	let organizationId: string

	if (targetProjectId) {
		const project = await getProject(targetProjectId, userId)
		if (!project) {
			return ApiResponse.notFound('Project not found')
		}

		organizationId = project.organizationId
	} else {
		const organization = await getOrCreateDefaultOrganization(userId)
		organizationId = organization.id
	}

	const uploadEntitlement = await hasEntitlement(organizationId, 'scene_upload')
	if (uploadEntitlement.granted) {
		return { organizationId }
	}

	if (isBillingStateReadOnly(uploadEntitlement.billingState)) {
		return ApiResponse.paymentRequired(
			'Image generation is unavailable until billing access is restored.'
		)
	}

	return ApiResponse.forbidden(
		'Image generation is not available on your current plan.'
	)
}

function ensureImageFile(file: File, maxImageBytes: number): Response | null {
	if (!IMAGE_MIME_TYPES.has(file.type)) {
		return ApiResponse.badRequest(
			'Only PNG, JPEG, and WebP images can be used for image-to-3D generation.'
		)
	}

	if (file.size === 0) {
		return ApiResponse.badRequest('Uploaded image is empty.')
	}

	if (file.size > maxImageBytes) {
		return ApiResponse.error(
			`Uploaded image exceeds the ${Math.round(maxImageBytes / (1024 * 1024))} MB limit.`,
			413
		)
	}

	return null
}

function ensureJobAccess(params: {
	jobId: string
	jobToken: string
	userId: string
}): Response | null {
	try {
		const payload = verifyTrellisJobToken(params.jobToken)
		if (payload.jobId !== params.jobId || payload.userId !== params.userId) {
			return ApiResponse.forbidden('Forbidden')
		}

		return null
	} catch (error) {
		return ApiResponse.forbidden(
			error instanceof Error ? error.message : 'Invalid generation token'
		)
	}
}

export async function submitTrellisGeneration(params: {
	request: Request
	userId: string
	file: File
	targetProjectId?: string
}) {
	const maxImageBytes = getMaxImageBytes()
	const fileCheck = ensureImageFile(params.file, maxImageBytes)
	if (fileCheck) {
		return fileCheck
	}

	const rateLimitResult = checkAuthRateLimit(params.request, {
		bucket: 'trellis-generation-submit',
		keyParts: [params.userId],
		maxRequests: readPositiveInt(
			process.env.TRELLIS_RATE_LIMIT_MAX_REQUESTS,
			DEFAULT_RATE_LIMIT_MAX_REQUESTS
		),
		windowMs: readPositiveInt(
			process.env.TRELLIS_RATE_LIMIT_WINDOW_MS,
			DEFAULT_RATE_LIMIT_WINDOW_MS
		)
	})

	if (rateLimitResult.limited) {
		return ApiResponse.error(
			'Too many generation requests. Please retry shortly.',
			429,
			{
				headers: {
					'Retry-After': String(rateLimitResult.retryAfterSeconds)
				}
			}
		)
	}

	const entitlementResult = await ensureSceneUploadEntitlement(
		params.userId,
		params.targetProjectId
	)
	if (entitlementResult instanceof Response) {
		return entitlementResult
	}

	try {
		const runtimeJob = await trellisRuntimeClient.submitGeneration(params.file)
		const jobToken = createTrellisJobToken({
			jobId: runtimeJob.jobId,
			userId: params.userId,
			expiresAt:
				Date.now() +
				readPositiveInt(
					process.env.TRELLIS_JOB_TOKEN_TTL_MS,
					DEFAULT_JOB_TOKEN_TTL_MS
				)
		})

		return ApiResponse.success({
			...runtimeJob,
			jobToken
		})
	} catch (error) {
		return mapRuntimeError(error, 'Failed to submit Trellis generation job')
	}
}

export async function getTrellisGenerationStatus(params: {
	jobId: string
	jobToken: string
	userId: string
}) {
	const accessError = ensureJobAccess(params)
	if (accessError) {
		return accessError
	}

	try {
		const status = await trellisRuntimeClient.getGenerationStatus(params.jobId)
		return ApiResponse.success({
			...status,
			jobToken: params.jobToken
		})
	} catch (error) {
		return mapRuntimeError(error, 'Failed to fetch Trellis generation status')
	}
}

export async function getTrellisGenerationArtifact(params: {
	jobId: string
	jobToken: string
	userId: string
}) {
	const accessError = ensureJobAccess(params)
	if (accessError) {
		return accessError
	}

	try {
		const runtimeArtifact = await trellisRuntimeClient.getGenerationArtifact(
			params.jobId
		)
		const headers = new Headers(runtimeArtifact.headers)
		headers.set('Cache-Control', 'no-store')

		return new Response(runtimeArtifact.body, {
			status: runtimeArtifact.status,
			headers
		})
	} catch (error) {
		return mapRuntimeError(error, 'Failed to download generated model')
	}
}

