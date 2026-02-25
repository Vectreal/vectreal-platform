import { createHash } from 'node:crypto'

import { and, eq, gt, isNull, or } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { apiKeyProjects } from '../../../db/schema/auth/api-key-projects'
import { apiKeys } from '../../../db/schema/auth/api-keys'

const db = getDbClient()

const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 60

type AttemptWindow = {
	count: number
	windowEndsAt: number
}

const attemptWindows = new Map<string, AttemptWindow>()

function parseBearerToken(authorizationHeader: string | null): string | null {
	if (!authorizationHeader) return null
	const [scheme, token] = authorizationHeader.split(' ')
	if (!scheme || !token) return null
	if (scheme.toLowerCase() !== 'bearer') return null

	const trimmed = token.trim()
	return trimmed.length > 0 ? trimmed : null
}

function getClientIdentifier(request: Request): string {
	const forwardedFor = request.headers
		.get('x-forwarded-for')
		?.split(',')[0]
		?.trim()
	if (forwardedFor) return forwardedFor

	const realIp = request.headers.get('x-real-ip')?.trim()
	if (realIp) return realIp

	return 'unknown'
}

function isRateLimited(clientIdentifier: string): boolean {
	const now = Date.now()
	const currentWindow = attemptWindows.get(clientIdentifier)

	if (!currentWindow || currentWindow.windowEndsAt <= now) {
		attemptWindows.set(clientIdentifier, {
			count: 0,
			windowEndsAt: now + WINDOW_MS
		})
		return false
	}

	return currentWindow.count >= MAX_ATTEMPTS
}

function trackFailedAttempt(clientIdentifier: string) {
	const now = Date.now()
	const currentWindow = attemptWindows.get(clientIdentifier)

	if (!currentWindow || currentWindow.windowEndsAt <= now) {
		attemptWindows.set(clientIdentifier, {
			count: 1,
			windowEndsAt: now + WINDOW_MS
		})
		return
	}

	currentWindow.count += 1
	attemptWindows.set(clientIdentifier, currentWindow)
}

export function hashApiToken(token: string): string {
	return createHash('sha256').update(token).digest('hex')
}

export function getPreviewTokenFromRequest(request: Request): string | null {
	const url = new URL(request.url)
	const queryToken = url.searchParams.get('token')?.trim()
	if (queryToken) return queryToken

	return parseBearerToken(request.headers.get('authorization'))
}

export type PreviewApiKeyValidationResult =
	| {
			ok: true
			apiKeyId: string
			projectId: string
			userId: string
	  }
	| {
			ok: false
			error: 'missing_token' | 'invalid_token' | 'rate_limited'
	  }

export async function validatePreviewApiKeyForProject(params: {
	request: Request
	projectId: string
}): Promise<PreviewApiKeyValidationResult> {
	const { request, projectId } = params
	const clientIdentifier = getClientIdentifier(request)

	if (isRateLimited(clientIdentifier)) {
		return { ok: false, error: 'rate_limited' }
	}

	const token = getPreviewTokenFromRequest(request)
	if (!token) {
		trackFailedAttempt(clientIdentifier)
		return { ok: false, error: 'missing_token' }
	}

	const hashedToken = hashApiToken(token)
	const now = new Date()

	const matches = await db
		.select({
			apiKeyId: apiKeys.id,
			projectId: apiKeyProjects.projectId,
			userId: apiKeys.userId
		})
		.from(apiKeys)
		.innerJoin(apiKeyProjects, eq(apiKeyProjects.apiKeyId, apiKeys.id))
		.where(
			and(
				eq(apiKeys.hashedKey, hashedToken),
				eq(apiKeyProjects.projectId, projectId),
				eq(apiKeys.active, true),
				isNull(apiKeys.revokedAt),
				or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now))
			)
		)
		.limit(1)

	if (matches.length === 0) {
		trackFailedAttempt(clientIdentifier)
		return { ok: false, error: 'invalid_token' }
	}

	await db
		.update(apiKeys)
		.set({ lastUsedAt: now })
		.where(eq(apiKeys.id, matches[0].apiKeyId))

	return {
		ok: true,
		apiKeyId: matches[0].apiKeyId,
		projectId: matches[0].projectId,
		userId: matches[0].userId
	}
}
