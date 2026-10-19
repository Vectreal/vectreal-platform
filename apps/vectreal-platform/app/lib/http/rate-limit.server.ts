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
	/**
	 * Most one address may make across every `keyParts` value in the window.
	 *
	 * `keyParts` narrows the limit on purpose - one person writing about two
	 * things is not blocked by their own first message - but a narrow key alone
	 * resets for whoever rotates the part, so one address could try a password
	 * against unlimited accounts or mail unlimited inboxes. This coarser count
	 * sits beside the narrow one, in the same window, and a request is refused
	 * when either is full.
	 *
	 * Every caller `resolveClientIp` cannot identify shares one address,
	 * `unknown`, and so one ceiling. Only traffic that bypasses Cloudflare lands
	 * there (and local dev). That is deliberate: the fix is restricting the
	 * origin to Cloudflare, never a fallback to a header the caller writes.
	 */
	addressCeiling?: number
	/**
	 * Whether the narrow key includes the caller's address. Default `true`.
	 *
	 * `false` is for a key that already names one caller the server resolved
	 * itself, such as an agent grant: its limit must not reset when the CLI
	 * changes networks, and one office NAT must not pool every agent behind it.
	 * Never set it with a key part the caller chooses. `addressCeiling` keys by
	 * address either way.
	 */
	includeClientIp?: boolean
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

	const address =
		options.includeClientIp === false ? [] : [resolveClientIp(request.headers)]

	return [options.bucket, ...address, ...parts].join(':')
}

/**
 * Every counter a request is held to, with the maximum each allows.
 *
 * The address counter is named apart from the bucket's own (`~address`), so it
 * cannot collide with a bucket that uses no `keyParts` and keys on the address
 * already.
 */
function countersFor(
	request: Request,
	options: RateLimitOptions
): { key: string; max: number }[] {
	const counters = [
		{ key: buildKey(request, options), max: options.maxRequests }
	]
	if (options.addressCeiling !== undefined) {
		counters.push({
			key: `${options.bucket}~address:${resolveClientIp(request.headers)}`,
			max: options.addressCeiling
		})
	}
	return counters
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

	return combine(
		countersFor(request, options).map(({ key, max }) => {
			const recent = recentTimestamps(key, now - windowMs)
			return {
				limited: recent.length >= max,
				retryAfterSeconds: retryAfterSeconds(recent, windowMs, now)
			}
		})
	)
}

/**
 * Refused when any counter is full, for as long as the longest wait among the
 * full ones. With none full, the wait reported is the narrow counter's, which
 * is what a single-counter caller always got.
 */
function combine(results: RateLimitResult[]): RateLimitResult {
	const full = results.filter((result) => result.limited)
	if (full.length === 0) {
		return results[0] as RateLimitResult
	}

	return {
		limited: true,
		retryAfterSeconds: Math.max(
			...full.map((result) => result.retryAfterSeconds)
		)
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
	const counters = countersFor(request, options).map(({ key, max }) => ({
		key,
		max,
		timestamps: recentTimestamps(key, now - windowMs)
	}))

	// One refusal records nothing anywhere, for the same reason a single
	// counter does not record a refused request: counting it would extend the
	// block it is serving and grow the array past the limit.
	const limited = counters.some(
		({ timestamps, max }) => timestamps.length >= max
	)
	for (const { key, timestamps } of counters) {
		if (!limited) {
			timestamps.push(now)
		}
		attempts.set(key, { windowMs, timestamps })
	}

	evictStale(now)

	return combine(
		counters.map(({ timestamps, max }) => ({
			limited: timestamps.length >= max && limited,
			retryAfterSeconds: retryAfterSeconds(timestamps, windowMs, now)
		}))
	)
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
