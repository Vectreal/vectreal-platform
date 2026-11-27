import { createCookie, redirect } from 'react-router'

/**
 * Carries the address a confirmation email went to from sign-up or sign-in to
 * `/auth/confirm-pending`, which shows it masked and resends to it.
 *
 * A cookie rather than `?email=` in the URL. A URL is copied everywhere a page
 * is reported from: analytics (`$current_url` on every event), session replay,
 * the server's request log, browser history and the `Referer` of anything the
 * page loads. The address stays on the server side of this cookie: httpOnly,
 * read only by the confirm-pending loader and action, and the page receives
 * the masked form alone.
 *
 * Unsigned on purpose. It only ever names the visitor's own address, and
 * someone who sets it by hand can do no more than post that address to the
 * resend form, which was always possible.
 *
 * `Path=/auth`, not the page path: single fetch loads and posts the page
 * through `/auth/confirm-pending.data`, which a cookie scoped to
 * `/auth/confirm-pending` does not match. A day covers waiting for an email
 * that is slow or lost and resending it; after that the resend refuses and
 * signing in again (which redirects back here) sets it anew.
 */
const confirmPendingEmailCookie = createCookie('confirm_pending_email', {
	path: '/auth',
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'lax',
	maxAge: 60 * 60 * 24
})

/** The redirect to `/auth/confirm-pending` for `email`, with `next` kept. */
export async function redirectToConfirmPending(
	request: Request,
	email: string,
	next: string
): Promise<Response> {
	const url = new URL('/auth/confirm-pending', new URL(request.url).origin)
	url.searchParams.set('next', next)
	return redirect(url.toString(), {
		headers: {
			'Set-Cookie': await confirmPendingEmailCookie.serialize(email)
		}
	})
}

/** The address the last confirmation email went to, or `null`. */
export async function readConfirmPendingEmail(
	request: Request
): Promise<null | string> {
	const value: unknown = await confirmPendingEmailCookie.parse(
		request.headers.get('Cookie')
	)
	return typeof value === 'string' && value.includes('@') ? value : null
}

/** The `Set-Cookie` that removes the address once it is no longer needed. */
export function clearConfirmPendingEmail(): Promise<string> {
	return confirmPendingEmailCookie.serialize('', { maxAge: 0 })
}
