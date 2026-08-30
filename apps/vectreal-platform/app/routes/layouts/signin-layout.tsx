import { GithubLogo } from '@shared/components/assets/icons/github-logo'
import GoogleLogo from '@shared/components/assets/icons/google-logo'
import { Button } from '@shared/components/ui/button'
import { Separator } from '@shared/components/ui/separator'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
	Link,
	Outlet,
	useFetchers,
	useLocation,
	useNavigate,
	useNavigation,
	useSubmit
} from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'

import { Route } from './+types/signin-layout'
import { useConsent } from '../../components/consent/consent-context'
import { AuthErrorBoundary } from '../../components/errors'
import HeroScene from '../../components/home/hero-scene'
import { TurnstileWidget } from '../../components/turnstile-widget'
import { useSpendTurnstileToken } from '../../hooks/use-spend-turnstile-token'
import {
	clearReferralAttribution,
	getReferralAttribution,
	saveReferralAttribution
} from '../../lib/domain/analytics/referral-attribution'
import { duration, ease } from '../../lib/motion/motion-tokens'

/**
 * No `resetTurnstile`. Invalidating a token is the layout's job, because the
 * layout is what owns it - see `useSpendTurnstileToken`. Handing children a
 * reset is what let each of them invalidate on their own response shape, and a
 * redirecting action has no response to observe.
 */
export interface AuthLayoutContext {
	turnstileToken: string | null
	hasTurnstile: boolean
}

export async function loader() {
	return {
		turnstileSiteKey: process.env.CLOUDFLARE_TURNSTILE_SITE_KEY ?? ''
	}
}

const SignupModel = () => {
	return (
		<div className="relative flex h-full w-full items-center justify-center md:block">
			<HeroScene vertical />
			{/*
				A half-width cap wrapped the tagline to three lines at narrower desktop
				widths, and the third sat below the visible area of the column. Two
				thirds keeps it to two.
			*/}
			<div className="absolute right-0 bottom-0 z-10 max-w-2/3 px-8 pb-10">
				<p className="text-primary/75! text-right text-xl! font-extralight!">
					Join our community and start creating amazing{' '}
					<strong className="text-primary">
						3D experiences with Vectreal.
					</strong>
				</p>
			</div>
			<div className="from-background absolute bottom-0 h-96 w-full bg-linear-to-t to-transparent" />
		</div>
	)
}

const SigninLayout = ({ loaderData }: Route.ComponentProps) => {
	const submit = useSubmit()
	const csrfToken = useAuthenticityToken()
	const location = useLocation()
	const navigate = useNavigate()
	const nextPath =
		new URLSearchParams(location.search).get('next') || '/dashboard'

	/*
	  Five routes sit under this layout and only two of them ask the visitor to
	  choose a credential. The other three - the post-signup confirmation gate
	  and the two password screens - used to inherit the whole apparatus anyway:
	  a heading reading "Sign In", the Google and GitHub buttons, the "or"
	  separator, a switch offering to sign up to someone who just did, and a
	  second copy of the legal footer beneath their own. So the confirmation
	  screen, which is on the account-creation funnel, read as broken.

	  Naming the three cases rather than adding a second boolean beside
	  `isSignUp`, because the question the chrome asks is not "is this sign-up"
	  but "is this a credential choice at all".

	  The pathname is normalized first, because React Router matches a route more
	  loosely than `endsWith` does: it compiles the path with a trailing `\/*$`
	  and matches case-insensitively, so `/sign-up/` and `/SIGN-UP` both render
	  the sign-up page. Comparing the raw pathname would classify those as
	  `other` and serve the sign-up form with no Google or GitHub button on it.
	*/
	const normalizedPath = location.pathname.toLowerCase().replace(/\/+$/, '')
	const authScreen = normalizedPath.endsWith('/sign-up')
		? 'sign-up'
		: normalizedPath.endsWith('/sign-in')
			? 'sign-in'
			: 'other'
	const isSignUp = authScreen === 'sign-up'
	const isCredentialChoice = authScreen !== 'other'

	const { consent } = useConsent()

	// Referral/campaign attribution (referrer + utm_source) is non-essential and
	// governed by the marketing consent category, mirroring how PostHog analytics
	// is gated in ConsentProvider.
	// null = no decision yet → write nothing (ePrivacy/GDPR-safe).
	// granted → persist attribution from the current page.
	// withdrawn → clear any previously stored attribution.
	useEffect(() => {
		if (consent === null) return
		if (consent.marketing) {
			saveReferralAttribution()
		} else {
			clearReferralAttribution()
		}
	}, [consent?.marketing, consent])

	const [loadingProvider, setLoadingProvider] = useState<
		null | 'google' | 'github'
	>(null)
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
	const [turnstileResetNonce, setTurnstileResetNonce] = useState(0)
	const pendingProviderRef = useRef<'google' | 'github' | null>(null)

	const resetTurnstile = useCallback(() => {
		setTurnstileToken(null)
		setTurnstileResetNonce((n) => n + 1)
	}, [])

	/*
	  A Turnstile token is single-use, so it dies when it is submitted rather than
	  when the server answers.

	  Both watchers are needed. `useNavigation()` covers the sign-in and sign-up
	  forms; `useFetchers()` covers the "Resend confirmation email" fetcher on
	  `/auth/confirm-pending`, which is the submission the reported bug was
	  actually replaying a spent token on. Dropping either one fails no test and
	  no type check - it just silently stops invalidating that half.
	*/
	const navigation = useNavigation()
	const fetchers = useFetchers()
	useSpendTurnstileToken({
		submissions: [navigation, ...fetchers],
		token: turnstileToken,
		onSpend: resetTurnstile
	})

	function submitSocialLogin(
		provider: 'google' | 'github',
		captchaToken?: string
	) {
		const formData = new FormData()
		formData.append('provider', provider)
		formData.append('backURL', nextPath)
		formData.append('csrf', csrfToken)
		if (captchaToken) {
			formData.append('cf-turnstile-response', captchaToken)
		}
		const { referrer, utm_source } = getReferralAttribution()
		if (referrer) formData.append('referrer', referrer)
		if (utm_source) formData.append('utm_source', utm_source)
		// Attribution is cleared in onboarding-page on mount, after user_signed_up
		// has already fired server-side. Clearing here would lose attribution if
		// OAuth fails or the user cancels and returns to this page.
		// Use a full navigation submit so external OAuth redirects happen in the
		// top-level browsing context instead of a background fetch request.
		submit(formData, {
			method: 'post',
			action: '/auth/social-signin'
		})
	}

	function handleSocialLogin(provider: 'google' | 'github') {
		if (loadingProvider) return
		setLoadingProvider(provider)

		if (!loaderData.turnstileSiteKey) {
			// No site key configured - submit without Turnstile (e.g. local dev)
			submitSocialLogin(provider)
			return
		}

		if (turnstileToken) {
			// Token already resolved - consume it immediately and submit.
			const token = turnstileToken
			resetTurnstile()
			submitSocialLogin(provider, token)
			return
		}

		// Token not ready yet - CF is still assessing. Store the pending provider;
		// handleTurnstileSuccess will submit once the challenge resolves.
		pendingProviderRef.current = provider
	}

	function handleTurnstileSuccess(token: string) {
		if (pendingProviderRef.current) {
			// An OAuth click was waiting - consume the token and submit immediately.
			const provider = pendingProviderRef.current
			pendingProviderRef.current = null
			submitSocialLogin(provider, token)
			resetTurnstile()
			return
		}
		// No pending OAuth - store for the email form's hidden field.
		setTurnstileToken(token)
	}

	function handleTurnstileError() {
		setTurnstileToken(null)
		if (pendingProviderRef.current) {
			pendingProviderRef.current = null
			setLoadingProvider(null)
		}
	}

	const handleSwitch = () => {
		navigate(`${isSignUp ? '/sign-in' : '/sign-up'}${location.search}`, {
			viewTransition: true
		})
	}

	return (
		/*
		  The reduced-motion guard lives here rather than in each child, because
		  `MotionConfig` is React context: a child route's provider cannot reach the
		  layout's own animated chrome above it, which is what left the
		  "Redirecting to…" line moving for people who asked it not to.
		*/
		<MotionConfig reducedMotion="user">
			<main className="h-full min-h-dvh w-full overflow-hidden">
				<section className="flex min-h-dvh w-full flex-col overflow-hidden">
					<div className="grid grow overflow-hidden md:grid-cols-[1fr_1fr]">
						<div className="ds-raised relative flex flex-col justify-center p-8 shadow-2xl">
							<div className="mx-auto flex max-w-md flex-col gap-8 py-16">
								{isCredentialChoice && (
									<div className="flex grow flex-col justify-end">
										<h1 className="text-h2 mb-6">
											{isSignUp ? 'Sign Up' : 'Sign In'}
										</h1>
									</div>
								)}

								{isCredentialChoice && (
									<>
										<div className="flex w-full flex-col gap-4 md:flex-row">
											<Button
												className="grow"
												onClick={() => handleSocialLogin('google')}
												disabled={loadingProvider !== null}
												style={{
													opacity: loadingProvider === 'github' ? 0.45 : 1,
													transition: `opacity var(--duration-base) var(--ease-out)`
												}}
											>
												<span className="relative flex items-center justify-center gap-2">
													{/* Idle label - defines the button width */}
													<span
														className="flex items-center gap-2 transition-opacity duration-150"
														style={{
															opacity: loadingProvider === 'google' ? 0 : 1
														}}
													>
														<GoogleLogo className="h-4 w-4" /> Continue with
														Google
													</span>
													{/* Loading overlay - absolutely positioned, same space */}
													<span
														className="absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-150"
														style={{
															opacity: loadingProvider === 'google' ? 1 : 0
														}}
														aria-hidden={loadingProvider !== 'google'}
													>
														<Loader2 className="h-4 w-4 animate-spin" />
														Connecting…
													</span>
												</span>
											</Button>
											<Button
												className="grow"
												onClick={() => handleSocialLogin('github')}
												disabled={loadingProvider !== null}
												style={{
													opacity: loadingProvider === 'google' ? 0.45 : 1,
													transition: `opacity var(--duration-base) var(--ease-out)`
												}}
											>
												<span className="relative flex items-center justify-center gap-2">
													<span
														className="flex items-center gap-2 transition-opacity duration-150"
														style={{
															opacity: loadingProvider === 'github' ? 0 : 1
														}}
													>
														<GithubLogo className="h-4 w-4" /> Continue with
														GitHub
													</span>
													<span
														className="absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-150"
														style={{
															opacity: loadingProvider === 'github' ? 1 : 0
														}}
														aria-hidden={loadingProvider !== 'github'}
													>
														<Loader2 className="h-4 w-4 animate-spin" />
														Connecting…
													</span>
												</span>
											</Button>
										</div>
										<AnimatePresence>
											{loadingProvider && (
												<motion.p
													initial={{ opacity: 0, y: -6 }}
													animate={{ opacity: 1, y: 0 }}
													exit={{ opacity: 0, y: -6 }}
													transition={{
														duration: duration.fast,
														ease: ease.out
													}}
													className="text-muted-foreground -mt-4 text-center text-sm"
												>
													Redirecting to{' '}
													{loadingProvider === 'google' ? 'Google' : 'GitHub'}…
												</motion.p>
											)}
										</AnimatePresence>
										<span className="relative">
											<Separator />
											{/*
									Paint the chip with the panel's base raised surface (4% mix)
									so it masks the separator seamlessly. Not `ds-raised`: nested
									inside the ds-raised panel it steps up to 8% (see
									`.ds-raised .ds-raised` in globals.css) and reads as a darker
									box, most visibly in light mode.
								*/}
											<p className="text-muted-foreground absolute left-1/2 -translate-x-1/2 -translate-y-3 bg-[color-mix(in_oklch,var(--foreground)_4%,var(--background))] px-2">
												or
											</p>
										</span>
									</>
								)}

								<Outlet
									context={
										{
											turnstileToken,
											hasTurnstile: !!loaderData.turnstileSiteKey
										} satisfies AuthLayoutContext
									}
								/>
								{loaderData.turnstileSiteKey && (
									<TurnstileWidget
										siteKey={loaderData.turnstileSiteKey}
										onSuccess={handleTurnstileSuccess}
										onError={handleTurnstileError}
										resetNonce={turnstileResetNonce}
									/>
								)}
								{/*
								Both belong to the credential choice. The switch offers to sign
								up to someone who has just signed up, and the sign-up form
								carries its own Terms checkbox, so on the confirmation screen
								this was a second consent notice for a decision already made.
							*/}
								{isCredentialChoice && (
									<div className="mt-4 flex grow flex-col items-center justify-between">
										<button
											type="button"
											className="text-muted-foreground text-sm transition-colors hover:underline"
											onClick={handleSwitch}
										>
											{isSignUp
												? 'Already have an account? Sign in'
												: "Don't have an account? Sign up"}
										</button>
										<p className="text-muted-foreground mt-2 max-w-xs text-center text-xs">
											By continuing, you agree to our{' '}
											<Link
												viewTransition
												to="/privacy-policy"
												className="hover:text-primary underline"
											>
												Privacy Policy
											</Link>{' '}
											and{' '}
											<Link
												viewTransition
												to="/terms-of-service"
												className="hover:text-primary underline"
											>
												Terms of Service
											</Link>
											.
										</p>
									</div>
								)}
							</div>
						</div>
						<div className="bg-muted/50 hidden items-center justify-center md:flex">
							<SignupModel />
						</div>
					</div>
				</section>
			</main>
		</MotionConfig>
	)
}

export default SigninLayout

export { AuthErrorBoundary as ErrorBoundary }
