/**
 * /forgot-password
 *
 * Sends a Supabase password-reset email via Resend (through the send-auth-email hook).
 * Always returns 200 regardless of whether the email is registered - prevents enumeration.
 */
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import { useId } from 'react'
import {
	data,
	Link,
	redirect,
	useFetcher,
	type MetaFunction
} from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'

import { Route } from './+types/forgot-password'
import { AuthErrorBoundary } from '../../components/errors'
import { checkAuthRateLimit } from '../../lib/domain/auth/auth-rate-limit.server'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'
import { buildMeta } from '../../lib/seo'
import { createSupabaseClient } from '../../lib/supabase.server'

export { AuthErrorBoundary as ErrorBoundary }

export const meta: MetaFunction = () =>
	buildMeta(
		[
			{ title: 'Forgot Password - Vectreal' },
			{ property: 'og:title', content: 'Forgot Password - Vectreal' }
		],
		undefined,
		{ private: true }
	)

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActionData {
	ok: boolean
	error?: string
	rateLimited?: boolean
}

// ─── Loader ───────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
	const { client, headers } = await createSupabaseClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()
	if (user) return redirect('/dashboard', { headers })
	return data({}, { headers })
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) return csrfCheck

	const email = formData.get('email')
	if (!email || typeof email !== 'string' || !email.includes('@')) {
		return data<ActionData>(
			{ ok: false, error: 'Please enter a valid email address.' },
			{ status: 400 }
		)
	}

	const normalizedEmail = email.trim().toLowerCase()
	const rateLimitResult = checkAuthRateLimit(request, {
		bucket: 'auth-password-reset',
		maxRequests: 3,
		keyParts: [normalizedEmail]
	})

	if (rateLimitResult.limited) {
		return data<ActionData>(
			{ ok: false, rateLimited: true },
			{
				status: 429,
				headers: { 'Retry-After': String(rateLimitResult.retryAfterSeconds) }
			}
		)
	}

	const { client, headers } = await createSupabaseClient(request)
	const url = new URL(request.url)
	const redirectTo = `${url.origin}/reset-password`

	// Fire-and-forget style - never reveal whether the email exists (OWASP A7)
	await client.auth.resetPasswordForEmail(normalizedEmail, { redirectTo })

	return data<ActionData>({ ok: true }, { headers })
}

// ─── Motion config ────────────────────────────────────────────────────────────

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number]

// ─── Component ────────────────────────────────────────────────────────────────

export default function ForgotPassword() {
	const fetcher = useFetcher<ActionData>()
	const emailId = useId()

	const isSending = fetcher.state !== 'idle'
	const wasSubmitted = fetcher.data?.ok === true
	const formError = fetcher.data?.error
	const isRateLimited = fetcher.data?.rateLimited

	return (
		<MotionConfig reducedMotion="user">
			<div className="w-full max-w-md">
				<motion.div
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, ease }}
				>
					<h1 className="mb-2 text-2xl font-semibold">Forgot your password?</h1>
					<p className="text-muted-foreground mb-8 text-sm leading-relaxed">
						Enter your account email and we'll send you a reset link.
					</p>
				</motion.div>

				<AnimatePresence mode="wait">
					{wasSubmitted ? (
						/* Success state */
						<motion.div
							key="success"
							initial={{ opacity: 0, scale: 0.97 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ duration: 0.3, ease }}
							className="flex flex-col items-center gap-4 py-8 text-center"
						>
							<div
								className="flex h-14 w-14 items-center justify-center rounded-2xl"
								style={{
									background: 'rgba(34,197,94,0.1)',
									border: '1px solid rgba(34,197,94,0.25)'
								}}
							>
								<CheckCircle2 className="h-6 w-6 text-green-500" />
							</div>
							<div>
								<p className="mb-1 font-medium">Check your inbox</p>
								<p className="text-muted-foreground text-sm">
									If that address is registered, a reset link is on its way.
								</p>
							</div>
							<Link
								to="/sign-in"
								className="text-muted-foreground mt-2 text-sm underline-offset-2 hover:underline"
							>
								Back to sign in
							</Link>
						</motion.div>
					) : (
						/* Form state */
						<motion.div key="form" exit={{ opacity: 0 }}>
							<fetcher.Form method="post">
								<AuthenticityTokenInput />

								{/* Form-level error */}
								<AnimatePresence>
									{(formError || isRateLimited) && (
										<motion.div
											key="error"
											initial={{ opacity: 0, height: 0, marginBottom: 0 }}
											animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
											exit={{ opacity: 0, height: 0, marginBottom: 0 }}
											className="border-destructive/50 bg-destructive/10 text-destructive overflow-hidden rounded-lg border p-4 text-sm"
											role="alert"
											aria-live="assertive"
										>
											{isRateLimited
												? 'Too many requests. Please wait before trying again.'
												: formError}
										</motion.div>
									)}
								</AnimatePresence>

								<div className="mb-6">
									<label
										className="mb-2 block text-sm font-medium"
										htmlFor={emailId}
									>
										Email
									</label>
									<div className="relative">
										<Input
											id={emailId}
											name="email"
											type="email"
											autoComplete="email"
											placeholder="jane@example.com"
											required
											className="pr-10"
										/>
										<Mail className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
									</div>
								</div>

								<Button
									type="submit"
									className="w-full font-semibold"
									disabled={isSending}
								>
									{isSending ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Sending…
										</>
									) : (
										'Send reset link'
									)}
								</Button>
							</fetcher.Form>

							<p className="text-muted-foreground mt-6 text-center text-sm">
								Remember your password?{' '}
								<Link
									to="/sign-in"
									className="text-foreground underline-offset-2 hover:underline"
								>
									Sign in
								</Link>
							</p>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</MotionConfig>
	)
}
