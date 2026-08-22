import { createHash } from 'node:crypto'

import { and, eq, gt, isNull, or } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { apiKeyProjects } from '../../../db/schema/auth/api-key-projects'
import { apiKeys } from '../../../db/schema/auth/api-keys'
import { projects } from '../../../db/schema/project/projects'
import {
	decideEmbedAccess,
	getPreviewTokenFromRequest,
	type EmbedAccessDecision,
	type EmbedKeyMatch
} from '../embed/embed-access-policy'

/**
 * Lookup and rate limiting for embed access. The decision itself lives in
 * `embed/embed-access-policy.ts`, which has no database import and is therefore
 * testable; this module exists to feed it a row and to record the outcome.
 */

const db = getDbClient()

const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 60

type AttemptWindow = {
	count: number
	windowEndsAt: number
}

const attemptWindows = new Map<string, AttemptWindow>()

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

/** Stays here rather than in the policy module: it needs `node:crypto`. */
export function hashApiToken(token: string): string {
	return createHash('sha256').update(token).digest('hex')
}

export type PreviewApiKeyValidationResult = EmbedAccessDecision

/**
 * The one live key for this project matching the hash, or null.
 *
 * Revoked, deactivated and expired keys are excluded in SQL rather than after
 * the fact, so a caller cannot forget the check.
 */
async function findLiveKeyForProject(
	hashedToken: string,
	projectId: string,
	now: Date
): Promise<EmbedKeyMatch | null> {
	const matches = await db
		.select({
			apiKeyId: apiKeys.id,
			projectId: apiKeyProjects.projectId,
			userId: apiKeys.userId,
			apiKeyOrganizationId: apiKeys.organizationId,
			projectOrganizationId: projects.organizationId,
			allowedEmbedDomains: projects.allowedEmbedDomains
		})
		.from(apiKeys)
		.innerJoin(apiKeyProjects, eq(apiKeyProjects.apiKeyId, apiKeys.id))
		.innerJoin(projects, eq(projects.id, apiKeyProjects.projectId))
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

	return matches[0] ?? null
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
	const now = new Date()

	// No token means no lookup: an absent token can match no key, and querying
	// for one would let an unauthenticated caller drive database load.
	const match = token
		? await findLiveKeyForProject(hashApiToken(token), projectId, now)
		: null

	const decision = decideEmbedAccess({ request, token, match })

	if (!decision.ok) {
		trackFailedAttempt(clientIdentifier)
		return decision
	}

	await db
		.update(apiKeys)
		.set({ lastUsedAt: now })
		.where(eq(apiKeys.id, decision.apiKeyId))

	return decision
}
