import { createCookieSessionStorage } from 'react-router'

const GUEST_OPTIMIZE_QUOTA_COOKIE_NAME = 'guest-optimize-quota'
const GUEST_OPTIMIZE_QUOTA_WINDOW_MS = 1000 * 60 * 60 * 24
const GUEST_OPTIMIZE_QUOTA_MAX_AGE_SECONDS = 60 * 60 * 24
const GUEST_OPTIMIZE_QUOTA_LIMIT = 5

const GUEST_OPTIMIZE_WINDOW_STARTED_AT_KEY = 'windowStartedAt'
const GUEST_OPTIMIZE_CONSUMED_COUNT_KEY = 'consumedCount'

const guestQuotaSecret = process.env.CSRF_SECRET ?? process.env.SESSION_SECRET
if (!guestQuotaSecret && process.env.NODE_ENV === 'production') {
	throw new Error('Cookie session secret is required in production')
}

const resolvedSessionSecret =
	guestQuotaSecret || 'dev-only-guest-optimize-secret'

type GuestOptimizeQuotaSessionData = {
	windowStartedAt?: number
	consumedCount?: number
}

type GuestOptimizeQuotaSessionFlashData = {
	error: string
}

type GuestOptimizeQuotaSnapshot = {
	limit: number
	currentValue: number
	remaining: number
	windowStartedAt: number
	windowExpiresAt: number
	outcome: 'within_limit' | 'soft_limit_warning' | 'hard_limit_exceeded'
}

const { getSession, commitSession } = createCookieSessionStorage<
	GuestOptimizeQuotaSessionData,
	GuestOptimizeQuotaSessionFlashData
>({
	cookie: {
		name: GUEST_OPTIMIZE_QUOTA_COOKIE_NAME,
		httpOnly: true,
		path: '/',
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: GUEST_OPTIMIZE_QUOTA_MAX_AGE_SECONDS,
		secrets: [resolvedSessionSecret]
	}
})

function clampConsumedCount(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return 0
	}

	if (value <= 0) {
		return 0
	}

	return Math.min(Math.floor(value), GUEST_OPTIMIZE_QUOTA_LIMIT)
}

function isWindowActive(windowStartedAt: number, now: number): boolean {
	return now - windowStartedAt < GUEST_OPTIMIZE_QUOTA_WINDOW_MS
}

function getOutcome(limit: number, currentValue: number) {
	if (currentValue >= limit) {
		return 'hard_limit_exceeded' as const
	}

	if (currentValue / limit >= 0.8) {
		return 'soft_limit_warning' as const
	}

	return 'within_limit' as const
}

export async function getGuestOptimizeQuotaSession(request: Request) {
	return getSession(request.headers.get('Cookie'))
}

export function readGuestOptimizeQuotaSnapshot(
	session: Awaited<ReturnType<typeof getGuestOptimizeQuotaSession>>,
	now = Date.now()
): GuestOptimizeQuotaSnapshot {
	const persistedWindowStartedAt = Number(
		session.get(GUEST_OPTIMIZE_WINDOW_STARTED_AT_KEY) || 0
	)
	const hasActiveWindow =
		persistedWindowStartedAt > 0 &&
		isWindowActive(persistedWindowStartedAt, now)
	const windowStartedAt = hasActiveWindow ? persistedWindowStartedAt : now
	const currentValue = hasActiveWindow
		? clampConsumedCount(session.get(GUEST_OPTIMIZE_CONSUMED_COUNT_KEY))
		: 0
	const remaining = Math.max(0, GUEST_OPTIMIZE_QUOTA_LIMIT - currentValue)

	return {
		limit: GUEST_OPTIMIZE_QUOTA_LIMIT,
		currentValue,
		remaining,
		windowStartedAt,
		windowExpiresAt: windowStartedAt + GUEST_OPTIMIZE_QUOTA_WINDOW_MS,
		outcome: getOutcome(GUEST_OPTIMIZE_QUOTA_LIMIT, currentValue)
	}
}

export function consumeGuestOptimizeQuota(
	session: Awaited<ReturnType<typeof getGuestOptimizeQuotaSession>>,
	now = Date.now()
): { consumed: boolean; snapshot: GuestOptimizeQuotaSnapshot } {
	const snapshot = readGuestOptimizeQuotaSnapshot(session, now)
	if (snapshot.remaining <= 0) {
		return { consumed: false, snapshot }
	}

	const nextValue = snapshot.currentValue + 1
	session.set(GUEST_OPTIMIZE_WINDOW_STARTED_AT_KEY, snapshot.windowStartedAt)
	session.set(GUEST_OPTIMIZE_CONSUMED_COUNT_KEY, nextValue)

	const nextSnapshot = readGuestOptimizeQuotaSnapshot(session, now)
	return { consumed: true, snapshot: nextSnapshot }
}

export async function commitGuestOptimizeQuotaSession(
	session: Awaited<ReturnType<typeof getGuestOptimizeQuotaSession>>
) {
	return commitSession(session)
}
