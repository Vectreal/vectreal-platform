/**
 * An email signup keeps the place the visitor was headed.
 *
 * The publisher sends an anonymous visitor who wants to save to
 * `/sign-in?next=/publisher?restore_draft=1&draft_id=...`, with the scene
 * written to IndexedDB, and tells them it will be waiting. The OAuth callback
 * carried that `next` through onboarding; the email path did not. The signup
 * action wrote `next=/onboarding` into the confirmation link and `confirm.ts`
 * sent every signup to a bare `/onboarding` regardless, so the visitor
 * finished onboarding on the dashboard and never saw their scene again.
 *
 * The first fix put the draft into `emailRedirectTo` as a query parameter, and
 * the email hook then made that whole URL the link's `next`, so the draft
 * arrived one level down and resolved to `/dashboard`. Every case here runs
 * the real hand-off, the action's `emailRedirectTo` through the link the email
 * hook builds into the confirm route, because each half passed on its own.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getSafeNextPath } from '../app/lib/domain/auth/auth-redirect.server'
import {
	readConfirmPendingEmail,
	redirectToConfirmPending
} from '../app/lib/domain/auth/confirm-pending-email.server'
import { buildConfirmLink } from '../app/lib/email/auth-confirm-link'
import { __resetRateLimitsForTest } from '../app/lib/http/rate-limit.server'
import { loader as confirmLoader } from '../app/routes/api/auth/confirm'
import {
	action as resendAction,
	loader as pendingLoader
} from '../app/routes/confirm-pending'
import { action as signinAction } from '../app/routes/signin-page/signin-page'
import { action as signupAction } from '../app/routes/signup-page/signup-page'

// Hoisted with the mocks below, which run before the imports above resolve.
const {
	signUp,
	signInWithPassword,
	resend,
	verifyOtp,
	getUser,
	captureServerEvent
} = vi.hoisted(() => ({
	signUp: vi.fn(),
	signInWithPassword: vi.fn(),
	getUser: vi.fn(),
	resend: vi.fn(),
	verifyOtp: vi.fn(),
	captureServerEvent: vi.fn()
}))

vi.mock('../app/lib/supabase.server', () => ({
	createSupabaseClient: async () => ({
		client: { auth: { signUp, signInWithPassword, resend, verifyOtp, getUser } }
	})
}))
vi.mock('../app/lib/http/csrf.server', () => ({
	ensureValidCsrfFormData: async () => null
}))
vi.mock('../app/lib/domain/analytics/server-events.server', () => ({
	captureServerEvent
}))
vi.mock('../app/lib/observability/report-server-error.server', () => ({
	reportServerError: () => {}
}))

const DRAFT = '/publisher?restore_draft=1&draft_id=abc'
const ORIGIN = 'https://vectreal.test'

function signupRequest(next: string | null, fields: Record<string, string>) {
	const form = new FormData()
	form.set('email', 'visitor@example.com')
	form.set('password', 'correct horse battery')
	form.set('confirm_password', 'correct horse battery')
	form.set('tos_accepted', 'on')
	for (const [name, value] of Object.entries(fields)) form.set(name, value)
	const url = new URL('/sign-up', ORIGIN)
	if (next) url.searchParams.set('next', next)
	return new Request(url, { method: 'POST', body: form })
}

// What the send_email hook does with the options the action handed Supabase.
function emailedLink(emailRedirectTo: string) {
	return buildConfirmLink({
		siteUrl: ORIGIN,
		tokenHash: 'hash',
		type: 'signup',
		redirectTo: emailRedirectTo
	})
}

async function clickLink(link: string) {
	const response = (await confirmLoader({
		request: new Request(link),
		context: {},
		params: {}
	} as never)) as Response
	return new URL(response.headers.get('Location') as string, ORIGIN)
}

async function signUpAndConfirm(
	next: string | null,
	fields: Record<string, string> = {}
) {
	const result = (await signupAction({
		request: signupRequest(next, fields),
		context: {},
		params: {}
	} as never)) as Response
	const { options } = signUp.mock.calls[0][0]
	// Supabase keeps `options.data` as the account's user_metadata.
	verifyOtp.mockResolvedValue({
		data: { user: { id: 'u1', user_metadata: options.data } },
		error: null
	})
	const landing = await clickLink(emailedLink(options.emailRedirectTo))
	return { result, landing }
}

// The cookie a browser would send back after the action's redirect.
function cookieFrom(response: Response) {
	return (response.headers.get('Set-Cookie') ?? '').split(';')[0]
}

function draftOf(landing: URL) {
	// Onboarding resolves this before it redirects; it must survive intact.
	return getSafeNextPath(landing.searchParams.get('next'))
}

beforeEach(() => {
	__resetRateLimitsForTest()
	signUp.mockReset()
	resend.mockReset()
	verifyOtp.mockReset()
	captureServerEvent.mockReset()
	signUp.mockResolvedValue({
		data: { user: { id: 'u1', email_confirmed_at: null } },
		error: null
	})
	resend.mockResolvedValue({ error: null })
	getUser.mockResolvedValue({ data: { user: null } })
})

describe('an email signup returns to where it started', () => {
	it('lands in onboarding carrying the draft', async () => {
		const { landing } = await signUpAndConfirm(DRAFT)

		expect(landing.pathname).toBe('/onboarding')
		expect(draftOf(landing)).toBe(DRAFT)
	})

	it('goes to plain onboarding when there is nowhere to return to', async () => {
		const { landing } = await signUpAndConfirm(null)

		expect(`${landing.pathname}${landing.search}`).toBe('/onboarding')
	})

	it('resolves a hostile next instead of forwarding it', async () => {
		const { landing } = await signUpAndConfirm('//evil.com/x')

		expect(landing.origin).toBe(ORIGIN)
		expect(`${landing.pathname}${landing.search}`).toBe('/onboarding')
	})

	it('records the referral on the signup event, through the account', async () => {
		await signUpAndConfirm(DRAFT, {
			referrer: 'https://news.example/post',
			utm_source: 'newsletter'
		})

		expect(captureServerEvent).toHaveBeenCalledWith(
			undefined,
			expect.any(Request),
			'u1',
			{
				name: 'user_signed_up',
				props: {
					method: 'email',
					referrer: 'https://news.example/post',
					utm_source: 'newsletter'
				}
			}
		)
	})
})

describe('a resent confirmation returns to the same place', () => {
	it('carries the draft to the confirm-pending screen', async () => {
		const { result } = await signUpAndConfirm(DRAFT)

		const pending = new URL(result.headers.get('Location') as string, ORIGIN)
		expect(pending.pathname).toBe('/auth/confirm-pending')
		expect(pending.searchParams.get('next')).toBe(DRAFT)
	})

	/*
	  The address rides in a cookie, never the URL: a URL is copied into
	  every analytics event, the request log and browser history.
	*/
	it('keeps the address out of the URL and the page, in a cookie', async () => {
		const { result } = await signUpAndConfirm(DRAFT)
		const pending = (await pendingLoader({
			request: new Request(
				new URL(result.headers.get('Location') as string, ORIGIN),
				{ headers: { Cookie: cookieFrom(result) } }
			),
			context: {},
			params: {}
		} as never)) as unknown as { data: { maskedEmail: string } }

		expect(result.headers.get('Location')).not.toContain('visitor')
		expect(JSON.stringify(pending.data)).not.toContain('visitor@')
		expect(pending.data.maskedEmail).toBe('v****@example.com')
	})

	it('forgets the address once the emailed link is used', async () => {
		await signUpAndConfirm(DRAFT)
		const response = (await confirmLoader({
			request: new Request(
				emailedLink(signUp.mock.calls[0][0].options.emailRedirectTo)
			),
			context: {},
			params: {}
		} as never)) as Response

		expect(response.headers.get('Set-Cookie')).toMatch(
			/^confirm_pending_email=;.*Max-Age=0.*Path=\/auth/
		)
	})

	it('forgets the address when the screen finds the account confirmed', async () => {
		getUser.mockResolvedValue({
			data: { user: { id: 'u1', email_confirmed_at: '2026-11-27T12:00:00Z' } }
		})
		const response = (await pendingLoader({
			request: new Request(new URL('/auth/confirm-pending', ORIGIN)),
			context: {},
			params: {}
		} as never)) as Response

		expect(response.headers.get('Set-Cookie')).toMatch(
			/^confirm_pending_email=;.*Max-Age=0/
		)
	})

	it.each([
		['ab@example.com', 'a*@example.com'],
		['a@example.com', 'a*@example.com']
	])('masks a short address too (%s)', async (email, masked) => {
		const redirect = await redirectToConfirmPending(
			new Request(new URL('/sign-up', ORIGIN)),
			email,
			'/'
		)
		const pending = (await pendingLoader({
			request: new Request(new URL('/auth/confirm-pending', ORIGIN), {
				headers: { Cookie: cookieFrom(redirect) }
			}),
			context: {},
			params: {}
		} as never)) as unknown as { data: { maskedEmail: string } }

		expect(pending.data.maskedEmail).toBe(masked)
	})

	it('builds the resent link from it', async () => {
		const { result } = await signUpAndConfirm(DRAFT)
		const cookie = cookieFrom(result)
		const pending = (await pendingLoader({
			request: new Request(
				new URL(result.headers.get('Location') as string, ORIGIN),
				{ headers: { Cookie: cookie } }
			),
			context: {},
			params: {}
		} as never)) as unknown as { data: { next: string } }

		// What the screen's hidden field posts back; the address is the cookie.
		const form = new FormData()
		form.set('next', pending.data.next)
		await resendAction({
			request: new Request(new URL('/auth/confirm-pending', ORIGIN), {
				method: 'POST',
				body: form,
				headers: { Cookie: cookie }
			}),
			context: {},
			params: {}
		} as never)
		expect(resend.mock.calls[0][0].email).toBe('visitor@example.com')
		verifyOtp.mockResolvedValue({
			data: { user: { id: 'u1', user_metadata: {} } },
			error: null
		})

		const { emailRedirectTo } = resend.mock.calls[0][0].options
		const landing = await clickLink(emailedLink(emailRedirectTo))

		expect(landing.pathname).toBe('/onboarding')
		expect(draftOf(landing)).toBe(DRAFT)
	})
})

/*
  Signing in to an account whose address was never confirmed lands on the
  same screen, so it takes the same route there: the address in a cookie.
*/
describe('signing in before confirming', () => {
	it('sends the visitor to confirm-pending without the address in the URL', async () => {
		signInWithPassword.mockResolvedValue({
			data: { user: null, session: null },
			error: { message: 'Email not confirmed' }
		})
		const form = new FormData()
		form.set('email', 'Visitor@Example.com')
		form.set('password', 'correct horse battery')
		const url = new URL('/sign-in', ORIGIN)
		url.searchParams.set('next', DRAFT)

		const result = (await signinAction({
			request: new Request(url, { method: 'POST', body: form }),
			context: {},
			params: {}
		} as never)) as Response
		const pending = new URL(result.headers.get('Location') as string, ORIGIN)

		expect(pending.pathname).toBe('/auth/confirm-pending')
		expect(pending.searchParams.get('next')).toBe(DRAFT)
		expect(pending.toString()).not.toMatch(/visitor/i)
		expect(
			await readConfirmPendingEmail(
				new Request(pending, { headers: { Cookie: cookieFrom(result) } })
			)
		).toBe('visitor@example.com')
	})
})
