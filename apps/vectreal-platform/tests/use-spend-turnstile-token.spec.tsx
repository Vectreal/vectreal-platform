// @vitest-environment jsdom
/**
 * The defect this hook exists for, written as case 3.
 *
 * A Turnstile token is single-use. `signin-layout` used to let each child
 * invalidate it when that child's own action returned data, and a successful
 * sign-up returns `redirect(...)` - no data, no reset, so the spent token was
 * replayed on the next submit under the same layout and Supabase rejected it
 * with a captcha error the UI reported as nothing at all.
 *
 * The three guards are pinned separately, because each one alone looks
 * redundant and none is.
 */

import { render } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
	useSpendTurnstileToken,
	type TokenBearingSubmission
} from '../app/hooks/use-spend-turnstile-token'

function submissionWith(token: string): TokenBearingSubmission {
	const formData = new FormData()
	formData.set('cf-turnstile-response', token)
	return { formData }
}

const IDLE: TokenBearingSubmission = { formData: undefined }

function renderWith(
	submissions: readonly TokenBearingSubmission[],
	token: string | null,
	onSpend: (spent: string) => void
) {
	function Probe(props: {
		submissions: readonly TokenBearingSubmission[]
		token: string | null
	}) {
		useSpendTurnstileToken({ ...props, onSpend })
		return null
	}

	const view = render(<Probe submissions={submissions} token={token} />)
	return {
		rerender: (
			next: readonly TokenBearingSubmission[],
			nextToken: string | null
		) => view.rerender(<Probe submissions={next} token={nextToken} />)
	}
}

describe('useSpendTurnstileToken', () => {
	it('ignores a navigation that is not submitting anything', () => {
		const onSpend = vi.fn()
		renderWith([IDLE], 'tok-1', onSpend)

		expect(onSpend).not.toHaveBeenCalled()
	})

	it('spends the live token once, and reports which token was spent', () => {
		const onSpend = vi.fn()
		renderWith([submissionWith('tok-1')], 'tok-1', onSpend)

		expect(onSpend).toHaveBeenCalledOnce()
		expect(onSpend).toHaveBeenCalledWith('tok-1')
	})

	/*
	  The defect. React Router hands back the same `FormData` object across
	  `submitting` and `loading`, and an action redirect keeps the navigation in
	  `loading` for another render.
	*/
	it('spends once across the submitting and loading renders of one submission', () => {
		const onSpend = vi.fn()
		const inFlight = submissionWith('tok-1')
		const { rerender } = renderWith([inFlight], 'tok-1', onSpend)

		/*
		  The real sequence, wrapper identity included: `getLoadingNavigation`
		  returns a new navigation object and the redirect that follows returns
		  another, each carrying the same `submission.formData`. The token is null
		  from the first spend onward, exactly as production leaves it.
		*/
		rerender([{ formData: inFlight.formData }], null)
		rerender([{ formData: inFlight.formData }], null)

		expect(onSpend).toHaveBeenCalledOnce()
	})

	/*
	  Guard 2, in isolation. The OAuth path resets the token before submitting, so
	  the live token is null - or already replaced - when its navigation appears.
	  Spending again would throw away a freshly minted token.
	*/
	it('does not spend a token the owner is no longer holding', () => {
		const onSpend = vi.fn()
		renderWith([submissionWith('tok-1')], null, onSpend)
		expect(onSpend).not.toHaveBeenCalled()

		const onSpendReplaced = vi.fn()
		renderWith([submissionWith('tok-1')], 'tok-2', onSpendReplaced)
		expect(onSpendReplaced).not.toHaveBeenCalled()
	})

	/*
	  Guard 1, in isolation: the token is held constant so equality cannot be what
	  rejects the repeats, and each rerender passes a fresh wrapper around the
	  same FormData so keying the set on the wrapper cannot pass either. Delete
	  the WeakSet, or key it on the submission, and this is the case that fails.
	*/
	it('examines a submission once even when spending does not change the token', () => {
		const onSpend = vi.fn()
		const inFlight = submissionWith('tok-1')
		const { rerender } = renderWith([inFlight], 'tok-1', onSpend)

		rerender([{ formData: inFlight.formData }], 'tok-1')
		rerender([{ formData: inFlight.formData }], 'tok-1')

		expect(onSpend).toHaveBeenCalledOnce()
	})

	/*
	  With no site key the sign-up and sign-in forms still render the hidden
	  input, so they post an empty string while the live token is null.
	*/
	it('ignores the empty token an unconfigured Turnstile posts', () => {
		const onSpend = vi.fn()
		renderWith([submissionWith('')], null, onSpend)

		expect(onSpend).not.toHaveBeenCalled()
	})

	/*
	  Guard 3, in isolation. The layout's no-site-key OAuth branch submits with no
	  token field at all while the live token is also null, and `formData.get`
	  returns null for an absent field - so `null !== null` is false and equality
	  alone would spend, resetting a widget that is not even mounted.
	*/
	it('ignores a submission carrying no token field while holding no token', () => {
		const onSpend = vi.fn()
		renderWith([{ formData: new FormData() }], null, onSpend)

		expect(onSpend).not.toHaveBeenCalled()
	})

	// The resend button on /auth/confirm-pending submits through a fetcher.
	it('spends a token carried by a fetcher rather than the navigation', () => {
		const onSpend = vi.fn()
		renderWith([IDLE, submissionWith('tok-1')], 'tok-1', onSpend)

		expect(onSpend).toHaveBeenCalledOnce()
	})

	/*
	  The OAuth buttons render on every child route, `/auth/confirm-pending`
	  included, so its resend fetcher can be submitted while an OAuth navigation
	  is still in flight ahead of it in the list. Skipping an examined entry has
	  to keep scanning: stop at it and the resend's token is never spent, and the
	  next resend replays it - the exact bug this hook exists to prevent.
	*/
	it('spends a later submission when an earlier one is already examined', () => {
		const onSpend = vi.fn()
		const oauth = submissionWith('tok-1')

		// The OAuth handler reset the token before submitting, so this is skipped.
		const { rerender } = renderWith([oauth], null, onSpend)
		expect(onSpend).not.toHaveBeenCalled()

		// The widget minted tok-2, and the resend fetcher carries it.
		rerender(
			[{ formData: oauth.formData }, submissionWith('tok-2')],
			'tok-2'
		)

		expect(onSpend).toHaveBeenCalledOnce()
		expect(onSpend).toHaveBeenCalledWith('tok-2')
	})

	it('spends each of two successive submissions', () => {
		const onSpend = vi.fn()
		const { rerender } = renderWith([submissionWith('tok-1')], 'tok-1', onSpend)

		rerender([submissionWith('tok-2')], 'tok-2')

		expect(onSpend).toHaveBeenCalledTimes(2)
		expect(onSpend).toHaveBeenNthCalledWith(1, 'tok-1')
		expect(onSpend).toHaveBeenNthCalledWith(2, 'tok-2')
	})

	it('spends once under StrictMode double-invocation', () => {
		const onSpend = vi.fn()
		// Hoisted, because `navigation.formData` is one object across renders.
		const inFlight = submissionWith('tok-1')

		function Probe() {
			useSpendTurnstileToken({
				submissions: [inFlight],
				token: 'tok-1',
				onSpend
			})
			return null
		}

		render(
			<StrictMode>
				<Probe />
			</StrictMode>
		)

		expect(onSpend).toHaveBeenCalledOnce()
	})
})
