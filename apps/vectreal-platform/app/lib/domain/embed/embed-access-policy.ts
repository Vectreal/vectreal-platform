import {
	extractHostFromHeader,
	isAllowedEmbedHost,
	isLocalhostLike,
	normalizeHost,
	parseAllowedDomainPatterns
} from './embed-domain-policy'

/**
 * Decides whether a third-party request may load a published scene.
 *
 * This is the security boundary of the product's headline feature, and it lived
 * inside `preview-api-key-auth.server.ts`, which calls `getDbClient()` at module
 * scope. Importing it from a test therefore opened a database connection and
 * threw `Missing DATABASE_URL`, so the decision had no tests at all while the
 * lookup around it was the only thing standing in the way.
 *
 * Splitting decision from lookup is the same move `embed-asset-policy.ts` made
 * for the asset gate, and for the same reason: the rule can then be tested
 * directly, against hostile input, without Postgres.
 *
 * Deliberately free of Node APIs as well as of the database, so nothing here
 * needs a `.server` suffix. Token hashing stays behind in the server module
 * because it needs `node:crypto`.
 */

export type EmbedAccessFailure =
	'missing_token' | 'invalid_token' | 'rate_limited' | 'domain_not_allowed'

/** The row the key lookup returns, or null when no live key matched. */
export type EmbedKeyMatch = {
	apiKeyId: string
	projectId: string
	userId: string
	apiKeyOrganizationId: string
	projectOrganizationId: string
	allowedEmbedDomains: string | null
}

export type EmbedAccessDecision =
	| {
			ok: true
			apiKeyId: string
			projectId: string
			userId: string
			/**
			 * The organization that owns the project, not the one that owns the
			 * key. They are checked to be the same above, so either would do; this
			 * one is named for the question callers ask of it - whose plan governs
			 * what this embed renders.
			 */
			organizationId: string
	  }
	| { ok: false; error: EmbedAccessFailure }

export type RequestHostContext = {
	host: string | null
	source: 'referer' | 'origin' | 'missing'
}

function parseBearerToken(authorizationHeader: string | null): string | null {
	if (!authorizationHeader) return null
	const [scheme, token] = authorizationHeader.split(' ')
	if (!scheme || !token) return null
	if (scheme.toLowerCase() !== 'bearer') return null

	const trimmed = token.trim()
	return trimmed.length > 0 ? trimmed : null
}

export function getPreviewTokenFromRequest(request: Request): string | null {
	const url = new URL(request.url)
	const queryToken = url.searchParams.get('token')?.trim()
	if (queryToken) return queryToken

	return parseBearerToken(request.headers.get('authorization'))
}

/**
 * Which host the request claims to come from.
 *
 * `Referer` first, `Origin` second, and `missing` when neither survives. Missing
 * is a real case rather than an error: `window.open(url, 'noopener,noreferrer')`
 * strips `Referer`, and so does a `no-referrer` policy on the embedding page.
 */
export function resolveRequestHostContext(
	request: Request
): RequestHostContext {
	const refererHost = extractHostFromHeader(request.headers.get('referer'))
	if (refererHost) {
		return { host: refererHost, source: 'referer' }
	}

	const originHost = extractHostFromHeader(request.headers.get('origin'))
	if (originHost) {
		return { host: originHost, source: 'origin' }
	}

	return { host: null, source: 'missing' }
}

/**
 * The host half of the decision, kept as three named conditions because each one
 * is a separate product rule and reviewers need to see them individually.
 *
 * The localhost fallback is why a request with no `Referer` succeeds in local
 * development and fails in production. The internal-host rule is why opening an
 * embed URL from Vectreal itself always works and therefore proves nothing about
 * a customer's allowlist.
 */
export function isEmbedRequestHostAllowed(params: {
	request: Request
	allowedEmbedDomains: string | null
}): boolean {
	const allowedDomains = parseAllowedDomainPatterns(params.allowedEmbedDomains)
	const { host: requesterHost, source: requesterHostSource } =
		resolveRequestHostContext(params.request)
	const applicationHost = normalizeHost(new URL(params.request.url).hostname)

	const allowByLocalhostFallback =
		requesterHostSource === 'missing' && isLocalhostLike(applicationHost)

	const allowByInternalHost =
		requesterHost !== null && requesterHost === applicationHost

	const allowByAllowedDomain =
		requesterHost !== null && isAllowedEmbedHost(requesterHost, allowedDomains)

	return allowByLocalhostFallback || allowByInternalHost || allowByAllowedDomain
}

/**
 * The whole decision, given a request and whatever the key lookup found.
 *
 * A key that resolves to a different organization than the project reports
 * `invalid_token`, not a distinct code. Any separate answer would confirm that
 * the token is real and only mismatched, which is an oracle a caller can walk.
 */
export function decideEmbedAccess(params: {
	request: Request
	token: string | null
	match: EmbedKeyMatch | null
}): EmbedAccessDecision {
	if (!params.token) {
		return { ok: false, error: 'missing_token' }
	}

	const match = params.match
	if (!match) {
		return { ok: false, error: 'invalid_token' }
	}

	if (match.apiKeyOrganizationId !== match.projectOrganizationId) {
		return { ok: false, error: 'invalid_token' }
	}

	if (
		!isEmbedRequestHostAllowed({
			request: params.request,
			allowedEmbedDomains: match.allowedEmbedDomains
		})
	) {
		return { ok: false, error: 'domain_not_allowed' }
	}

	return {
		ok: true,
		apiKeyId: match.apiKeyId,
		projectId: match.projectId,
		userId: match.userId,
		organizationId: match.projectOrganizationId
	}
}
