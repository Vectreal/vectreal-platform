import { createHash } from 'node:crypto'

import { and, eq, gt, isNull, or } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { apiKeyProjects } from '../../../db/schema/auth/api-key-projects'
import { apiKeys } from '../../../db/schema/auth/api-keys'
import { projects } from '../../../db/schema/project/projects'
import {
	checkRateLimit,
	recordRateLimitAttempt
} from '../../http/rate-limit.server'
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

/*
  Failures only, and 60 in a minute.

  A storefront page with several embeds makes many legitimate successful
  requests, so counting every request against one per-IP limit would break the
  page it is meant to protect. Counting refusals is what actually distinguishes
  a visitor from something probing tokens.
*/
const EMBED_RATE_LIMIT = {
	bucket: 'embed-auth',
	maxRequests: 60,
	windowMs: 60_000
} as const

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

	if (checkRateLimit(request, EMBED_RATE_LIMIT).limited) {
		return { ok: false, error: 'rate_limited' }
	}

	const token = getPreviewTokenFromRequest(request)
	const now = new Date()
	const hashedToken = token ? hashApiToken(token) : null

	// No token means no lookup: an absent token can match no key, and querying
	// for one would let an unauthenticated caller drive database load.
	const match = hashedToken
		? await findLiveKeyForProject(hashedToken, projectId, now)
		: null

	const decision = decideEmbedAccess({ request, token, match })

	if (!decision.ok) {
		recordRateLimitAttempt(request, EMBED_RATE_LIMIT)
		return decision
	}

	/*
	  Written only while the secret this request authenticated with is still the
	  one on the row.

	  `now` is captured before the lookup, so a slow request can reach this write
	  long after a rotation has cleared `lastUsedAt` and a newer request has set
	  it. Keyed on the id alone, that stale write lands and drags the column back
	  behind `rotatedAt`, which is exactly the comparison the dashboard uses to
	  say "Unused since rotating". The indicator would then report a key nobody
	  had updated as one nobody had updated - by accident, for a key that was
	  fine.
	*/
	// A decision can only be `ok` when a row matched, which can only happen when
	// a token was present and hashed. The guard is here to say that in types
	// rather than to handle a reachable case.
	if (hashedToken) {
		await db
			.update(apiKeys)
			.set({ lastUsedAt: now })
			.where(
				and(
					eq(apiKeys.id, decision.apiKeyId),
					eq(apiKeys.hashedKey, hashedToken)
				)
			)
	}

	return decision
}
