// @vitest-environment jsdom
/**
 * The sign-in form submits to the URL it is on, parameters included.
 *
 * `useFormAction` copies `location.search` onto a submission only when the form
 * sets no `action` of its own (react-router's `lib/dom/lib.js`: `if (action ==
 * null) { path.search = location.search }`). The form named `action="/sign-in"`,
 * a literal path, so the POST arrived with a bare URL and the action's
 * `?next=...` was gone before anything could read it.
 *
 * That is the whole reason an anonymous visitor who signed in to save a scene
 * landed on `/dashboard`: the publisher had written the draft to IndexedDB and
 * put the recovery URL in `next`, and the form dropped it on submit.
 *
 * The real route component is rendered here rather than a stand-in form. A
 * fixture would keep passing the day someone puts the literal action back.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Outlet, createRoutesStub } from 'react-router'
import { AuthenticityTokenProvider } from 'remix-utils/csrf/react'
import { describe, expect, it, vi } from 'vitest'

import SigninPage from '../app/routes/signin-page/signin-page'
import SignupPage from '../app/routes/signup-page/signup-page'

const DRAFT_NEXT = '/publisher?restore_draft=1&draft_id=abc'

function renderSignIn(): { submitted: () => string | null } {
	let submittedUrl: string | null = null

	const Stub = createRoutesStub([
		{
			path: '/sign-in',
			Component: () => (
				<Outlet context={{ turnstileToken: null, hasTurnstile: false }} />
			),
			action: ({ request }: { request: Request }) => {
				submittedUrl = request.url
				return null
			},
			children: [
				{
					index: true,
					Component: SigninPage as never,
					loader: () => ({
						sceneSaved: false,
						authErrorCode: null,
						authErrorMessage: null,
						nextPath: null,
						user: null,
						isAuthenticated: false,
						message: null
					}),
					action: ({ request }: { request: Request }) => {
						submittedUrl = request.url
						return null
					}
				}
			]
		}
	])

	render(
		<AuthenticityTokenProvider token="test-csrf-token">
			<Stub
				initialEntries={[`/sign-in?next=${encodeURIComponent(DRAFT_NEXT)}`]}
			/>
		</AuthenticityTokenProvider>
	)

	return { submitted: () => submittedUrl }
}

describe('the sign-in form keeps its return path', () => {
	it('submits to a URL that still carries next', async () => {
		const { submitted } = renderSignIn()

		const submitButton = await screen.findByRole('button', {
			name: /^sign in$/i
		})
		const form = submitButton.closest('form')
		expect(form).not.toBeNull()

		fireEvent.submit(form as HTMLFormElement)

		await waitFor(() => expect(submitted()).not.toBeNull())

		const url = submitted() as string
		expect(new URL(url).searchParams.get('next')).toBe(DRAFT_NEXT)
	})
})

/*
  The sign-up form had the same literal action, `action="/sign-up"`, so a
  visitor who chose to create an account instead of signing in lost the draft
  the same way, one form over.
*/
describe('the sign-up form keeps its return path', () => {
	it('submits to a URL that still carries next', async () => {
		// jsdom has none, and the sign-up form measures its fields.
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe() {}
				unobserve() {}
				disconnect() {}
			}
		)
		const submitted: { url: string | null } = { url: null }
		const Stub = createRoutesStub([
			{
				path: '/sign-up',
				Component: () => (
					<Outlet context={{ turnstileToken: null, hasTurnstile: false }} />
				),
				children: [
					{
						index: true,
						Component: SignupPage as never,
						loader: () => ({
							accountDeleted: false,
							sceneSaved: false,
							nextPath: null
						}),
						action: ({ request }: { request: Request }) => {
							submitted.url = request.url
							return null
						}
					}
				]
			}
		])

		render(
			<AuthenticityTokenProvider token="test-csrf-token">
				<Stub
					initialEntries={[`/sign-up?next=${encodeURIComponent(DRAFT_NEXT)}`]}
				/>
			</AuthenticityTokenProvider>
		)

		const submitButton = await screen.findByRole('button', {
			name: /create account/i
		})
		fireEvent.submit(submitButton.closest('form') as HTMLFormElement)

		await waitFor(() => expect(submitted.url).not.toBeNull())
		expect(new URL(submitted.url as string).searchParams.get('next')).toBe(
			DRAFT_NEXT
		)
	})
})
