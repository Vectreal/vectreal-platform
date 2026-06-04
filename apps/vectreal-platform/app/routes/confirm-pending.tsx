/**
 * /auth/confirm-pending
 *
 * Shown after email/password signup. Instructs the user to check their inbox
 * and provides a rate-limited "Resend confirmation" button.
 */
import { Button } from '@shared/components/ui/button'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { Loader2, Mail, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { clearReferralAttribution } from '../lib/analytics/referral-attribution'
import { checkAuthRateLimit } from '../lib/domain/auth/auth-rate-limit.server'
import { ensureValidCsrfFormData } from '../lib/http/csrf.server'
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
	const next = url.searchParams.get('next') ?? '/onboarding'
	const referrer = url.searchParams.get('referrer') ?? ''
	const utm_source = url.searchParams.get('utm_source') ?? ''

	return data({ email, next, referrer, utm_source }, { headers })
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

	const rateLimitResult = checkAuthRateLimit(request, {
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
	if (typeof referrer === 'string' && referrer) confirmUrl.searchParams.set('referrer', referrer)
	if (typeof utm_source === 'string' && utm_source) confirmUrl.searchParams.set('utm_source', utm_source)

	const { client, headers } = await createSupabaseClient(request)
	const { error } = await client.auth.resend({
		type: 'signup',
		email: email.trim().toLowerCase(),
		options: { captchaToken, emailRedirectTo: confirmUrl.toString() }
	})

	if (error) {
		console.error('[auth/confirm-pending] resend failed', {
			message: error.message
		})
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

const RESEND_COOLDOWN_SECONDS = 60

export default function ConfirmPending() {
	const { email, referrer, utm_source } = useLoaderData<typeof loader>()
	const fetcher = useFetcher<ActionData>()
	const { turnstileToken, resetTurnstile, hasTurnstile } =
		useOutletContext<AuthLayoutContext>()

	const [cooldown, setCooldown] = useState(0)

	useEffect(() => {
		clearReferralAttribution()
	}, [])

	const isSending = fetcher.state !== 'idle'
	const wasSent = fetcher.data?.sent === true
	const sendError = fetcher.data?.error
	const isRateLimited = fetcher.data?.rateLimited

	// Start cooldown after a successful send; also reset Turnstile for next use
	useEffect(() => {
		if (!wasSent) return
		setCooldown(RESEND_COOLDOWN_SECONDS)
		resetTurnstile()
	}, [wasSent, resetTurnstile])

	// Countdown tick
	useEffect(() => {
		if (cooldown <= 0) return
		const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
		return () => clearTimeout(id)
	}, [cooldown])

	// When Turnstile is configured, block resend until the token is ready.
	const turnstileReady = !hasTurnstile || !!turnstileToken
	const canResend = !isSending && cooldown === 0 && turnstileReady

	return (
		<MotionConfig reducedMotion="user">
			<div className="bg-background flex flex-col items-center justify-center px-4">
				<motion.div
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
					className="w-full max-w-md"
				>
					{/* Icon */}
					<motion.div
						className="mb-6 flex justify-center"
						initial={{ scale: 0.8, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
					>
						<div
							className="flex h-16 w-16 items-center justify-center rounded-2xl"
							style={{
								background: 'rgba(252,108,24,0.1)',
								border: '1px solid rgba(252,108,24,0.2)'
							}}
						>
							<Mail className="h-7 w-7" style={{ color: '#fc6c18' }} />
						</div>
					</motion.div>

					{/* Heading */}
					<motion.h1
						className="mb-2 text-center text-2xl font-semibold"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.15 }}
					>
						Check your inbox
					</motion.h1>

					{/* Body */}
					<motion.p
						className="text-muted-foreground mb-8 text-center text-sm leading-relaxed"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.2 }}
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
						transition={{ delay: 0.25 }}
					>
						<fetcher.Form method="post">
							<AuthenticityTokenInput />
							<input type="hidden" name="email" value={email} />
							{referrer && <input type="hidden" name="referrer" value={referrer} />}
							{utm_source && <input type="hidden" name="utm_source" value={utm_source} />}
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
								className="overflow-hidden text-center text-sm text-green-500"
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
						transition={{ delay: 0.3 }}
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
		</MotionConfig>
	)
}
