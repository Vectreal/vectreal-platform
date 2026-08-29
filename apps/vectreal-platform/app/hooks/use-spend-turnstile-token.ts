import { useEffect, useRef } from 'react'

/** The field every auth form carries its Turnstile token in. */
const TURNSTILE_FIELD = 'cf-turnstile-response'

/**
 * The shape both `useNavigation()` and an entry of `useFetchers()` satisfy.
 *
 * `formData` is undefined while idle, and is the *same object* across
 * `submitting` and `loading`, which is what makes identity the right key below.
 */
export interface TokenBearingSubmission {
	formData: FormData | undefined
}

export interface SpendTurnstileTokenOptions {
	/** Every submission the token's owner can observe: `[navigation, ...fetchers]`. */
	submissions: readonly TokenBearingSubmission[]
	/** The token currently held, or null while a fresh one is being minted. */
	token: string | null
	/** Called once, with the spent token, the first time it leaves for the server. */
	onSpend: (spentToken: string) => void
	fieldName?: string
}

/**
 * Invalidates a Turnstile token the moment it is submitted, not when a response
 * comes back.
 *
 * A Turnstile token is single-use: Cloudflare answers a replay with
 * `timeout-or-duplicate`, and Supabase - which verifies the token server-side on
 * the auth routes - turns that into a captcha error. So whoever owns the token
 * has to know when it is gone.
 *
 * `signin-layout` used to leave that to its children, and each of them inferred
 * it from their own `actionData`. That proxy fails on exactly the path that
 * matters: a successful sign-up returns `redirect(...)`, which produces no
 * `actionData`, so nothing reset and the layout - which does not remount when
 * navigating between its own routes - carried the spent token into the next
 * submit. Signing up, landing on `/auth/confirm-pending` and pressing "Resend
 * confirmation email" replayed it every time, and the reason never reached the
 * user.
 *
 * Watching the request instead of the response asks the question that was
 * actually being asked.
 *
 * Three guards, doing different jobs. Each is load-bearing:
 *
 *   1. `examined`, keyed on `FormData` identity, makes a submission spend at
 *      most once however many renders it spans. React Router rebuilds the
 *      wrapper object on the `submitting` -> `loading` transition and again for
 *      the redirect that follows, while carrying the same `submission.formData`
 *      through all of them - so the `FormData` is the only stable key.
 *   2. The token equality check leaves the OAuth path alone. It also rejects a
 *      `File`, which is the other thing `formData.get` can return.
 *   3. `!carried` is what stops a submission carrying no token from spending
 *      one. `formData.get` returns null for an absent field, and the layout's
 *      no-site-key branch submits with no token while the live token is also
 *      null - so `null !== null` is false and equality alone would let it
 *      through, resetting a widget that is not even mounted.
 *
 * The two OAuth branches are safe for different reasons, which is worth knowing
 * before touching either: `handleSocialLogin` resets *before* submitting, so
 * the live token is already null; `handleTurnstileSuccess` submits before
 * resetting, but is only reachable while the live token is null anyway.
 *
 * Together the guards also make the obvious pathological loop unreachable:
 * spending a token mints a new one, and the stale `FormData` fails both guards
 * on the re-render.
 */
export function useSpendTurnstileToken({
	submissions,
	token,
	onSpend,
	fieldName = TURNSTILE_FIELD
}: SpendTurnstileTokenOptions): void {
	const examinedRef = useRef<WeakSet<FormData> | null>(null)
	if (examinedRef.current === null) examinedRef.current = new WeakSet()
	const examined = examinedRef.current

	/*
	  Held in a ref so the effect below always calls the latest handler. It cannot
	  go stale behind a dependency list because there is none, but the ref keeps
	  that true if one is ever added.
	*/
	const onSpendRef = useRef(onSpend)
	onSpendRef.current = onSpend

	/*
	  Deliberately no dependency array. The caller builds `submissions` fresh on
	  every render (`[navigation, ...fetchers]`), so a dependency list over it
	  would compare new array identities and re-run anyway. `examined` - not a
	  dependency list - is what makes this idempotent. It cannot loop: `onSpend`
	  sets state, and the resulting render finds the same `FormData` already
	  examined.
	*/
	useEffect(() => {
		for (const submission of submissions) {
			const { formData } = submission
			if (!formData) continue
			if (examined.has(formData)) continue
			examined.add(formData)

			const carried = formData.get(fieldName)
			if (!carried) continue
			if (carried !== token) continue

			onSpendRef.current(carried)
		}
	})
}
