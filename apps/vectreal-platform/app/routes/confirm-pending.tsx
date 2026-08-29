/**
 * /auth/confirm-pending
 *
 * Shown after email/password signup. Instructs the user to check their inbox
 * and provides a rate-limited "Resend confirmation" button.
 */
import { Button } from '@shared/components/ui/button'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Mail, RotateCcw } from 'lucide-react'
import { useEffect } from 'react'
import {
	data,
	Link,
	redirect,
	useFetcher,
	useLoaderData,
	useOutletContext,
	type MetaFunction
} from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'

import { Route } from './+types/confirm-pending'
import { AuthErrorBoundary } from '../components/errors'
import { useResendCooldown } from '../hooks/use-resend-cooldown'
import { clearReferralAttribution } from '../lib/domain/analytics/referral-attribution'
import { resendCooldownFor } from '../lib/domain/auth/resend-cooldown'
import { ensureValidCsrfFormData } from '../lib/http/csrf.server'
import { recordRateLimitAttempt } from '../lib/http/rate-limit.server'
import {
	authPanelEntrance,
	duration,
	ease,
	STAGGER_STEP
} from '../lib/motion/motion-tokens'
import { reportServerError } from '../lib/observability/report-server-error.server'
import { buildMeta } from '../lib/seo'
import { createSupabaseClient } from '../lib/supabase.server'

import type { AuthLayoutContext } from './layouts/signin-layout'

export { AuthErrorBoundary as ErrorBoundary }

export const meta: MetaFunction = () =>
	buildMeta([{ title: 'Check Your Email - Vectreal' }], undefined, {
		private: true
	})

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActionData {
	sent?: boolean
	error?: string
	rateLimited?: boolean
	retryAfterSeconds?: number
}

// ─── Loader ───────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
	const { client, headers } = await createSupabaseClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()

	// Already confirmed - send straight to onboarding (first-time) or dashboard
	// (the onboarding page is idempotent; existing users skip through it quickly)
	if (user?.email_confirmed_at) {
		return redirect('/onboarding', { headers })
	}

	const url = new URL(request.url)
	const email = url.searchParams.get('email') ?? ''
	const referrer = url.searchParams.get('referrer') ?? ''
	const utm_source = url.searchParams.get('utm_source') ?? ''

	/*
	  No `next`. It was carried into loader data that nothing read, while the
	  resend action hardcodes `/onboarding` as the confirmation destination - so
	  the screen looked like it honoured a return path and did not.
	*/
	return data({ email, referrer, utm_source }, { headers })
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) return csrfCheck

	const email = formData.get('email')
	if (!email || typeof email !== 'string' || !email.includes('@')) {
		return data<ActionData>(
			{ error: 'Invalid email address.' },
			{ status: 400 }
		)
	}

	const rateLimitResult = recordRateLimitAttempt(request, {
		bucket: 'auth-email-resend',
		maxRequests: 3,
		keyParts: [email.trim().toLowerCase()]
	})

	if (rateLimitResult.limited) {
		return data<ActionData>(
			{
				rateLimited: true,
				retryAfterSeconds: rateLimitResult.retryAfterSeconds
			},
			{
				status: 429,
				headers: { 'Retry-After': String(rateLimitResult.retryAfterSeconds) }
			}
		)
	}

	const turnstileToken = formData.get('cf-turnstile-response')
	const captchaToken =
		typeof turnstileToken === 'string' ? turnstileToken : undefined

	// Rebuild emailRedirectTo with referral params so the resent confirmation
	// link preserves attribution through to confirm.ts.
	const origin = new URL(request.url).origin
	const confirmUrl = new URL(`${origin}/auth/confirm`)
	confirmUrl.searchParams.set('type', 'signup')
	confirmUrl.searchParams.set('next', '/onboarding')
	const referrer = formData.get('referrer')
	const utm_source = formData.get('utm_source')
	if (typeof referrer === 'string' && referrer)
		confirmUrl.searchParams.set('referrer', referrer)
	if (typeof utm_source === 'string' && utm_source)
		confirmUrl.searchParams.set('utm_source', utm_source)

	const { client, headers } = await createSupabaseClient(request)
	const { error } = await client.auth.resend({
		type: 'signup',
		email: email.trim().toLowerCase(),
		options: { captchaToken, emailRedirectTo: confirmUrl.toString() }
	})

	if (error) {
		/*
		  The response still says `sent: true`, because telling a visitor which
		  addresses exist is an enumeration oracle. That makes this failure
		  invisible from the outside as well as the inside unless it is reported.
		*/
		reportServerError(error, { request })
	}

	return data<ActionData>({ sent: true }, { headers })
}

// ─── Mask email helper ────────────────────────────────────────────────────────

function maskEmail(email: string): string {
	const [local, domain] = email.split('@')
	if (!local || !domain) return email
	const visible = local.length > 2 ? local[0] : local
	return `${visible}${'*'.repeat(Math.min(local.length - 1, 4))}@${domain}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConfirmPending() {
	const { email, referrer, utm_source } = useLoaderData<typeof loader>()
	const fetcher = useFetcher<ActionData>()
	const { turnstileToken, hasTurnstile } = useOutletContext<AuthLayoutContext>()

	useEffect(() => {
		clearReferralAttribution()
	}, [])

	const cooldown = useResendCooldown(fetcher, resendCooldownFor)

	const isSending = fetcher.state !== 'idle'
	const wasSent = fetcher.data?.sent === true
	const sendError = fetcher.data?.error
	const isRateLimited = fetcher.data?.rateLimited

	// When Turnstile is configured, block resend until the token is ready.
	const turnstileReady = !hasTurnstile || !!turnstileToken
	const canResend = !isSending && cooldown === 0 && turnstileReady

	/*
	  No background of its own. The layout's panel is already a raised surface on
	  the elevation ladder, and painting the page background on top of it drew an
	  opaque hard-edged box inside the panel - the thing that made this screen
	  read as unfinished.
	*/
	return (
		<div className="flex flex-col items-center justify-center px-4">
			<motion.div {...authPanelEntrance} className="w-full max-w-md">
				{/* Icon */}
				{/*
						The brand tint goes through the channel form of the token. Applying
						a slash-alpha to the hex-backed color instead compiles to a
						`color-mix()` whose no-alpha fallback paints solid brand orange.
					*/}
				<motion.div
					className="mb-6 flex justify-center"
					initial={{ scale: 0.92, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{
						delay: duration.instant,
						duration: duration.slow,
						ease: ease.out
					}}
				>
					<div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgb(var(--orange-rgb)/0.2)] bg-[rgb(var(--orange-rgb)/0.1)]">
						<Mail className="text-orange h-7 w-7" />
					</div>
				</motion.div>

				{/* Heading */}
				<motion.h1
					className="text-h3 mb-2 text-center"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{
						delay: 2 * STAGGER_STEP,
						duration: duration.base,
						ease: ease.out
					}}
				>
					Check your inbox
				</motion.h1>

				{/* Body */}
				<motion.p
					className="text-muted-foreground mb-8 text-center text-sm leading-relaxed"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{
						delay: 3 * STAGGER_STEP,
						duration: duration.base,
						ease: ease.out
					}}
				>
					We sent a confirmation link to{' '}
					{email ? (
						<span className="text-foreground font-medium">
							{maskEmail(email)}
						</span>
					) : (
						'your email address'
					)}
					. Click the link in the email to activate your account.
				</motion.p>

				{/* Resend form */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{
						delay: 4 * STAGGER_STEP,
						duration: duration.base,
						ease: ease.out
					}}
				>
					<fetcher.Form method="post">
						<AuthenticityTokenInput />
						<input type="hidden" name="email" value={email} />
						{referrer && (
							<input type="hidden" name="referrer" value={referrer} />
						)}
						{utm_source && (
							<input type="hidden" name="utm_source" value={utm_source} />
						)}
						{turnstileToken && (
							<input
								type="hidden"
								name="cf-turnstile-response"
								value={turnstileToken}
							/>
						)}
						<Button
							type="submit"
							variant="outline"
							className="w-full"
							disabled={!canResend}
						>
							{isSending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Sending…
								</>
							) : cooldown > 0 ? (
								<>
									<RotateCcw className="mr-2 h-4 w-4" />
									Resend in {cooldown}s
								</>
							) : !turnstileReady ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Verifying…
								</>
							) : (
								<>
									<RotateCcw className="mr-2 h-4 w-4" />
									Resend confirmation email
								</>
							)}
						</Button>
					</fetcher.Form>
				</motion.div>

				{/* Feedback messages */}
				<AnimatePresence>
					{wasSent && (
						<motion.p
							key="sent"
							initial={{ opacity: 0, height: 0, marginTop: 0 }}
							animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
							exit={{ opacity: 0, height: 0, marginTop: 0 }}
							className="text-success-foreground overflow-hidden text-center text-sm"
							role="status"
						>
							Confirmation email sent - check your inbox.
						</motion.p>
					)}
					{(sendError || isRateLimited) && (
						<motion.p
							key="error"
							initial={{ opacity: 0, height: 0, marginTop: 0 }}
							animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
							exit={{ opacity: 0, height: 0, marginTop: 0 }}
							className="text-destructive overflow-hidden text-center text-sm"
							role="alert"
						>
							{isRateLimited
								? 'Too many requests. Please wait before trying again.'
								: sendError}
						</motion.p>
					)}
				</AnimatePresence>

				{/* Footer links */}
				<motion.div
					className="text-muted-foreground mt-8 flex flex-col items-center gap-2 text-sm"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{
						delay: 5 * STAGGER_STEP,
						duration: duration.base,
						ease: ease.out
					}}
				>
					<span>
						Wrong email?{' '}
						<Link
							to="/sign-up"
							className="text-foreground underline-offset-2 hover:underline"
						>
							Start over
						</Link>
					</span>
					<span>
						Already confirmed?{' '}
						<Link
							to="/sign-in"
							className="text-foreground underline-offset-2 hover:underline"
						>
							Sign in
						</Link>
					</span>
				</motion.div>
			</motion.div>
		</div>
	)
}
