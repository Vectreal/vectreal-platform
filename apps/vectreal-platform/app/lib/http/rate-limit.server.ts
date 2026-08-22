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

/**
 * Longest a single key part may contribute.
 *
 * Callers pass request-supplied strings as key parts - the auth routes pass the
 * submitted email, which is validated for an `@` and nothing else, and no body
 * size limit is configured. Without a bound, one request turns a multi-megabyte
 * field into a map key retained for the whole window. Truncating can only make
 * two callers share a bucket, which limits more than intended rather than less.
 */
const MAX_KEY_PART_LENGTH = 128

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

/**
 * Each key remembers the window it was recorded under.
 *
 * Buckets do not share a window - `embed-auth` and `auth-social-signin` run at
 * 60s while everything else runs at 10 minutes - and eviction sweeps the whole
 * map at once. Without the window travelling with the key, the sweep applies the
 * calling bucket's cutoff to every other bucket's entries. See `evictStale`.
 */
interface RecordedAttempts {
	windowMs: number
	timestamps: number[]
}

const attempts = new Map<string, RecordedAttempts>()
let evictCounter = 0

function buildKey(request: Request, options: RateLimitOptions): string {
	const parts = (options.keyParts ?? []).map((part) =>
		part.slice(0, MAX_KEY_PART_LENGTH)
	)

	return [options.bucket, resolveClientIp(request.headers), ...parts].join(':')
}

function recentTimestamps(key: string, windowStart: number): number[] {
	return (attempts.get(key)?.timestamps ?? []).filter((at) => at > windowStart)
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
 *
 * Each key is filtered against *its own* window rather than the caller's. An
 * earlier version passed the calling bucket's `windowStart` in and applied it to
 * every entry, so a 60s bucket sweeping a 10-minute bucket deleted timestamps
 * that were still live: any address probing embed tokens tripped a sweep about
 * once a minute and silently reset every sign-in, sign-up, password-reset and
 * contact-form limit on the instance.
 */
function evictStale(now: number) {
	evictCounter += 1
	if (evictCounter < DEFAULT_EVICT_EVERY) {
		return
	}

	evictCounter = 0
	for (const [key, recorded] of attempts) {
		const fresh = recorded.timestamps.filter(
			(at) => at > now - recorded.windowMs
		)
		if (fresh.length === 0) {
			attempts.delete(key)
		} else {
			attempts.set(key, { windowMs: recorded.windowMs, timestamps: fresh })
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
 * The combined form, for callers that limit every request they see. The limit is
 * tested *before* the request is recorded, on the same `>=` as `checkRateLimit`,
 * so the two agree by construction rather than by a compensating `>`. Admission
 * is unchanged either way: request N is allowed, N+1 is refused.
 *
 * A caller already over the limit is not recorded. Recording them extended their
 * own block, so a client obeying `Retry-After` to the second was refused again
 * on arrival and never got in, and the retained array grew once per rejected
 * request - unbounded memory and an O(n) filter per request on the path that is
 * supposed to be the cheap one. Not recording keeps the array at `maxRequests`,
 * which is also what makes `retryAfterSeconds` exact: dropping the oldest of
 * exactly `maxRequests` entries is precisely what readmits the caller.
 */
export function recordRateLimitAttempt(
	request: Request,
	options: RateLimitOptions
): RateLimitResult {
	const now = Date.now()
	const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
	const key = buildKey(request, options)

	const timestamps = recentTimestamps(key, now - windowMs)
	const limited = timestamps.length >= options.maxRequests
	if (!limited) {
		timestamps.push(now)
	}
	attempts.set(key, { windowMs, timestamps })

	evictStale(now)

	return {
		limited,
		retryAfterSeconds: retryAfterSeconds(timestamps, windowMs, now)
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

/**
 * Test seam. Never called by application code.
 *
 * The retained-array cap is invisible for the same reason: a capped and an
 * uncapped array answer `limited` identically, so only the size distinguishes
 * them.
 */
export function __rateLimitMaxEntriesForTest(): number {
	let largest = 0
	for (const recorded of attempts.values()) {
		largest = Math.max(largest, recorded.timestamps.length)
	}
	return largest
}
