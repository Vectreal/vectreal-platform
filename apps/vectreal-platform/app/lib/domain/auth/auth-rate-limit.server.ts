const DEFAULT_WINDOW_MS = 10 * 60 * 1000
const DEFAULT_EVICT_EVERY = 50

interface RateLimitOptions {
	maxRequests: number
	windowMs?: number
	bucket: string
	keyParts: string[]
}

interface RateLimitResult {
	limited: boolean
	retryAfterSeconds: number
}

const rateLimiter = new Map<string, number[]>()
let evictCounter = 0

function getClientIp(request: Request): string {
	const cfIp = request.headers.get('cf-connecting-ip')
	if (cfIp) {
		return cfIp
	}

	const forwarded = request.headers.get('x-forwarded-for')
	if (forwarded) {
		return forwarded.split(',')[0]?.trim() || 'unknown'
	}

	return 'unknown'
}

export function checkAuthRateLimit(
	request: Request,
	options: RateLimitOptions
): RateLimitResult {
	const now = Date.now()
	const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
	const windowStart = now - windowMs
	const key = [options.bucket, getClientIp(request), ...options.keyParts].join(
		':'
	)
	const attempts = rateLimiter.get(key) ?? []
	const recentAttempts = attempts.filter((timestamp) => timestamp > windowStart)

	recentAttempts.push(now)
	rateLimiter.set(key, recentAttempts)

	evictCounter += 1
	if (evictCounter >= DEFAULT_EVICT_EVERY) {
		evictCounter = 0
		for (const [k, timestamps] of rateLimiter) {
			const fresh = timestamps.filter((ts) => ts > windowStart)
			if (fresh.length === 0) {
				rateLimiter.delete(k)
			} else {
				rateLimiter.set(k, fresh)
			}
		}
	}

	const limited = recentAttempts.length > options.maxRequests
	const retryAfterMs = limited
		? Math.max(0, windowMs - (now - (recentAttempts[0] ?? now)))
		: 0

	return {
		limited,
		retryAfterSeconds: Math.ceil(retryAfterMs / 1000)
	}
}
