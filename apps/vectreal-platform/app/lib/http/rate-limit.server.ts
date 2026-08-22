import { resolveClientIp } from './client-identity'

/**
 * The one in-process rate limiter.
 *
 * There were three, written independently, and only one of them was right. The
 * auth limiter had a sliding window, a composable key, periodic eviction and a
 * retry hint; the contact form carried a private copy of nearly the same code;
 * the embed limiter had a fixed window, no eviction at all, and keyed on a
 * header the caller controls. This is the auth one, promoted, with the other two
 * deleted rather than reconciled.
 *
 * Scope is deliberately per-process. Each instance protecting its own connection
 * pool is what this is for, and it does that correctly. The cross-instance
 * per-IP limit belongs at Cloudflare, which already owns the edge rules in
 * terraform - it is filed, not forgotten. Running this against Postgres instead
 * would add load to the very resource the limiter exists to protect.
 */

const DEFAULT_WINDOW_MS = 10 * 60 * 1000
const DEFAULT_EVICT_EVERY = 50

export interface RateLimitOptions {
	/** Names the limit, so unrelated callers cannot collide in the map. */
	bucket: string
	/** Anything beyond the caller's address that narrows the limit. */
	keyParts?: string[]
	maxRequests: number
	windowMs?: number
}

export interface RateLimitResult {
	limited: boolean
	retryAfterSeconds: number
}

const attempts = new Map<string, number[]>()
let evictCounter = 0

function buildKey(request: Request, options: RateLimitOptions): string {
	return [
		options.bucket,
		resolveClientIp(request.headers),
		...(options.keyParts ?? [])
	].join(':')
}

function recentTimestamps(key: string, windowStart: number): number[] {
	return (attempts.get(key) ?? []).filter((at) => at > windowStart)
}

function retryAfterSeconds(recent: number[], windowMs: number, now: number) {
	const oldest = recent[0] ?? now
	return Math.ceil(Math.max(0, windowMs - (now - oldest)) / 1000)
}

/**
 * Periodically drops keys whose timestamps have all aged out.
 *
 * Without it the map grows once per distinct caller and never shrinks, which the
 * embed limiter demonstrated: it keyed on a spoofable header, so a caller could
 * mint unlimited keys and grow the map without bound while never being limited.
 */
function evictPeriodically(windowStart: number) {
	evictCounter += 1
	if (evictCounter < DEFAULT_EVICT_EVERY) {
		return
	}

	evictCounter = 0
	for (const [key, timestamps] of attempts) {
		const fresh = timestamps.filter((at) => at > windowStart)
		if (fresh.length === 0) {
			attempts.delete(key)
		} else {
			attempts.set(key, fresh)
		}
	}
}

/**
 * Whether this caller is already at the limit, without counting the request.
 *
 * For a caller that only counts some of its traffic. The embed limiter counts
 * failed authentications and not successful loads, because a storefront page
 * with several embeds makes many legitimate requests and a combined per-IP
 * counter would break it.
 */
export function checkRateLimit(
	request: Request,
	options: RateLimitOptions
): RateLimitResult {
	const now = Date.now()
	const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
	const recent = recentTimestamps(buildKey(request, options), now - windowMs)

	return {
		limited: recent.length >= options.maxRequests,
		retryAfterSeconds: retryAfterSeconds(recent, windowMs, now)
	}
}

/**
 * Counts this request against the limit and reports the result.
 *
 * The combined form, for callers that limit every request they see. `limited`
 * is `>` rather than `>=` because the request being recorded is included in the
 * count - the Nth request within the window is allowed, the N+1th is not.
 */
export function recordRateLimitAttempt(
	request: Request,
	options: RateLimitOptions
): RateLimitResult {
	const now = Date.now()
	const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
	const windowStart = now - windowMs
	const key = buildKey(request, options)

	const recent = recentTimestamps(key, windowStart)
	recent.push(now)
	attempts.set(key, recent)

	evictPeriodically(windowStart)

	return {
		limited: recent.length > options.maxRequests,
		retryAfterSeconds: retryAfterSeconds(recent, windowMs, now)
	}
}

/** Test seam. Never called by application code. */
export function __resetRateLimitsForTest() {
	attempts.clear()
	evictCounter = 0
}

/**
 * Test seam. Never called by application code.
 *
 * Eviction is only observable as map size: every read already filters by window,
 * so a stale key reports the same answer whether or not it was ever removed. A
 * test written against behaviour alone therefore passes with eviction deleted,
 * which is what happened to the first version of this file's spec.
 */
export function __rateLimitKeyCountForTest(): number {
	return attempts.size
}
