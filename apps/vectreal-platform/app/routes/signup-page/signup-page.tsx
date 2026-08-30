import {
	Alert,
	AlertDescription,
	AlertTitle
} from '@shared/components/ui/alert'
import { Button } from '@shared/components/ui/button'
import { Checkbox } from '@shared/components/ui/checkbox'
import { Input } from '@shared/components/ui/input'
import { cn } from '@shared/utils'
import { AnimatePresence, motion } from 'framer-motion'
import {
	Eye,
	EyeClosed,
	ExternalLink,
	Loader2,
	Save,
	ShieldCheck
} from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import {
	data,
	Form,
	Link,
	redirect,
	useNavigation,
	useOutletContext,
	type MetaFunction
} from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'

import { Route } from './+types/signup-page'
import { AuthErrorBoundary } from '../../components/errors'
import { getReferralAttribution } from '../../lib/domain/analytics/referral-attribution'
import { captureServerEvent } from '../../lib/domain/analytics/server-events.server'
import { classifySignupFailure } from '../../lib/domain/auth/signup-failure'
import {
	validateSignup,
	type SignupFieldErrors
} from '../../lib/domain/auth/signup-validation'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'
import { recordRateLimitAttempt } from '../../lib/http/rate-limit.server'
import {
	authFieldEntrance,
	duration,
	ease
} from '../../lib/motion/motion-tokens'
import { reportServerError } from '../../lib/observability/report-server-error.server'
import { buildMeta } from '../../lib/seo'
import { createSupabaseClient } from '../../lib/supabase.server'

import type { PostHogContext } from '../../lib/posthog/posthog-middleware'
import type { AuthLayoutContext } from '../layouts/signin-layout'

export { AuthErrorBoundary as ErrorBoundary }

export const meta: MetaFunction = () =>
	buildMeta(
		[
			{ title: 'Sign Up - Vectreal' },
			{ property: 'og:title', content: 'Sign Up - Vectreal' },
			{
				name: 'description',
				content:
					'Create your free Vectreal account and start publishing 3D content today.'
			}
		],
		undefined,
		{ private: true }
	)

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignupActionData {
	errors?: SignupFieldErrors
	formError?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getSafeNext = (request: Request) => {
	const url = new URL(request.url)
	const next = url.searchParams.get('next')
	if (!next || !next.startsWith('/')) return '/dashboard'
	return next
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function action({ request, context }: Route.ActionArgs) {
	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) return csrfCheck

	const {
		errors,
		data: { email, password, name }
	} = validateSignup(formData)

	if (Object.keys(errors).length > 0) {
		return data<SignupActionData>({ errors }, { status: 400 })
	}

	const normalizedEmail = email.trim().toLowerCase()
	const rateLimitResult = recordRateLimitAttempt(request, {
		bucket: 'auth-signup',
		maxRequests: 5,
		keyParts: [normalizedEmail]
	})

	if (rateLimitResult.limited) {
		return data<SignupActionData>(
			{ formError: 'Too many sign-up attempts. Please try again shortly.' },
			{
				status: 429,
				headers: { 'Retry-After': String(rateLimitResult.retryAfterSeconds) }
			}
		)
	}

	const turnstileToken = formData.get('cf-turnstile-response')
	const captchaToken =
		typeof turnstileToken === 'string' ? turnstileToken : undefined

	const referrer =
		typeof formData.get('referrer') === 'string'
			? (formData.get('referrer') as string)
			: ''
	const utmSource =
		typeof formData.get('utm_source') === 'string'
			? (formData.get('utm_source') as string)
			: ''

	const { client, headers } = await createSupabaseClient(request)

	// Build emailRedirectTo with referral attribution so confirm.ts can read it
	const origin = new URL(request.url).origin
	const confirmUrl = new URL(`${origin}/auth/confirm`)
	confirmUrl.searchParams.set('type', 'signup')
	confirmUrl.searchParams.set('next', '/onboarding')
	if (referrer) confirmUrl.searchParams.set('referrer', referrer)
	if (utmSource) confirmUrl.searchParams.set('utm_source', utmSource)

	let signupData: Awaited<ReturnType<typeof client.auth.signUp>>['data']
	let signupError: Awaited<ReturnType<typeof client.auth.signUp>>['error']

	try {
		const tosAcceptedAt = new Date().toISOString()
		const response = await client.auth.signUp({
			email: normalizedEmail,
			password,
			options: {
				/*
				  Omitted rather than sent as an empty string, now that the field is
				  optional. Readers of this metadata are split between `||` and `??`
				  - `onboarding-page` uses `??` to fall back to the email's local
				  part - and `''` is not nullish, so storing it would silently kill
				  every `??` fallback written for exactly this case.
				*/
				data: { ...(name && { name }), tos_accepted_at: tosAcceptedAt },
				captchaToken,
				emailRedirectTo: confirmUrl.toString()
			}
		})
		signupData = response.data
		signupError = response.error
	} catch (err) {
		// A thrown signUp is a transport or client failure, not a GoTrue verdict,
		// so there is no message to classify - only the generic fallback.
		const failure = classifySignupFailure('')
		reportServerError(err, {
			request,
			properties: { signup_failure_code: failure.code }
		})
		return data<SignupActionData>(
			{ formError: failure.message },
			{ status: failure.status, headers }
		)
	}

	if (signupData?.user) {
		// If Supabase already confirmed the user (local dev with enable_confirmations=false),
		// skip the confirm-pending gate and go straight to onboarding.
		if (signupData.user.email_confirmed_at) {
			const posthog = (context as PostHogContext).posthog
			captureServerEvent(posthog, request, signupData.user.id, {
				name: 'user_signed_up',
				props: {
					method: 'email',
					referrer: referrer || undefined,
					utm_source: utmSource || undefined
				}
			})
			return redirect('/onboarding', { headers: new Headers(headers) })
		}

		const confirmPendingUrl = new URL(
			'/auth/confirm-pending',
			new URL(request.url).origin
		)
		confirmPendingUrl.searchParams.set('email', normalizedEmail)
		if (referrer) confirmPendingUrl.searchParams.set('referrer', referrer)
		if (utmSource) confirmPendingUrl.searchParams.set('utm_source', utmSource)
		return redirect(confirmPendingUrl.toString(), {
			headers: new Headers(headers)
		})
	}

	if (signupError) {
		const failure = classifySignupFailure(signupError.message)

		if (failure.report) {
			/*
			  `signup_failure_code` is what turns "sign-ups are failing" into a
			  cause without reading stack traces, and the original message rides
			  along so a code of `unknown` names the message it did not recognize.
			*/
			reportServerError(signupError, {
				request,
				properties: {
					signup_failure_code: failure.code,
					supabase_message: signupError.message
				}
			})
		}

		return data<SignupActionData>(
			{ formError: failure.message },
			{ status: failure.status, headers }
		)
	}

	/*
	  Supabase returned neither a user nor an error. Nothing has ever been seen
	  taking this path, which is exactly why it reports rather than staying quiet.
	*/
	const unexpected = classifySignupFailure('')
	reportServerError(
		new Error('Supabase signUp returned neither a user nor an error'),
		{ request, properties: { signup_failure_code: unexpected.code } }
	)
	return data<SignupActionData>(
		{ formError: unexpected.message },
		{ status: unexpected.status, headers }
	)
}

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: Route.LoaderArgs) => {
	const { client, headers } = await createSupabaseClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()

	if (user) return redirect(getSafeNext(request), { headers })

	const url = new URL(request.url)
	const accountDeleted = url.searchParams.get('account_deleted') === 'true'
	const sceneSaved = url.searchParams.get('scene_saved') === 'true'
	const nextPath = url.searchParams.get('next') ?? null

	return data({ accountDeleted, sceneSaved, nextPath }, { headers })
}

// ─── Password strength helper ─────────────────────────────────────────────────

function getPasswordStrength(password: string): {
	score: number
	label: string
	/** Saturated hue for the bar, which is a non-text mark. */
	barColor: string
	/** Muted token class for the label, which is text and must clear AA. */
	labelClass: string
} {
	if (!password) return { score: 0, label: '', barColor: '', labelClass: '' }
	let score = 0
	// Length is the primary factor (NIST guidelines weight it most heavily)
	if (password.length >= 8) score++
	if (password.length >= 12) score += 2
	if (password.length >= 16) score++
	// Complexity adds secondary score
	if (/[A-Z]/.test(password)) score++
	if (/[0-9]/.test(password)) score++
	if (/[^a-zA-Z0-9]/.test(password)) score++
	if (score <= 2)
		return {
			score: 1,
			label: 'Weak',
			barColor: 'var(--destructive)',
			labelClass: 'text-destructive'
		}
	if (score <= 4)
		return {
			score: 2,
			label: 'Fair',
			barColor: 'var(--warning)',
			labelClass: 'text-warning-muted-foreground'
		}
	return {
		score: 3,
		label: 'Strong',
		barColor: 'var(--success)',
		labelClass: 'text-success-foreground'
	}
}

// ─── Motion config ────────────────────────────────────────────────────────────

/* Field order drives the stagger, so inserting a field cannot skip a beat. */
const fieldVariants = (index: number) => {
	const { initial, animate, transition } = authFieldEntrance(index)
	return { initial, animate: { ...animate, transition } }
}

// ─── Component ────────────────────────────────────────────────────────────────

const SignupPage = ({ loaderData, actionData }: Route.ComponentProps) => {
	const navigation = useNavigation()
	const isSubmitting = navigation.state === 'submitting'

	const [showPassword, setShowPassword] = useState(false)
	const [showConfirm, setShowConfirm] = useState(false)
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [tosChecked, setTosChecked] = useState(false)
	const [tosShake, setTosShake] = useState(false)
	const [referralData, setReferralData] = useState<{
		referrer?: string
		utm_source?: string
	}>({})

	const { turnstileToken, hasTurnstile } = useOutletContext<AuthLayoutContext>()

	useEffect(() => {
		setReferralData(getReferralAttribution())
	}, [])

	const nameId = useId()
	const emailId = useId()
	const passwordId = useId()
	const confirmId = useId()

	const errors: SignupFieldErrors =
		actionData && 'errors' in actionData ? (actionData.errors ?? {}) : {}
	const formError =
		actionData && 'formError' in actionData
			? (actionData.formError ?? null)
			: null

	const strength = getPasswordStrength(password)
	const passwordMismatch =
		confirmPassword.length > 0 && confirmPassword !== password

	const loaderTyped = loaderData as {
		accountDeleted: boolean
		sceneSaved: boolean
		nextPath: string | null
	}

	useEffect(() => {
		if (!actionData) return
		if ('errors' in actionData && actionData.errors?.tos) {
			setTosShake(true)
			setTimeout(() => setTosShake(false), 500)
		}
	}, [actionData])

	return (
		<div className="w-full max-w-md">
			{loaderTyped?.accountDeleted && (
				<motion.div
					initial={{ opacity: 0, y: -8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: duration.base, ease: ease.out }}
				>
					<Alert variant="success" role="status" className="mb-6">
						<ShieldCheck aria-hidden="true" />
						<AlertTitle>Account deleted</AlertTitle>
						<AlertDescription>
							Your Vectreal account was deleted successfully. You can create a
							new account at any time.
						</AlertDescription>
					</Alert>
				</motion.div>
			)}

			{/* Scene preservation notice */}
			{loaderTyped?.sceneSaved && (
				<motion.div
					initial={{ opacity: 0, y: -8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: duration.base, ease: ease.out }}
				>
					<Alert variant="success" role="status" className="mb-6">
						<Save aria-hidden="true" />
						<AlertTitle>Scene saved temporarily</AlertTitle>
						<AlertDescription>
							<p>
								Your scene has been saved. Create an account to make it
								permanent.
							</p>
							{loaderTyped.nextPath && (
								<Button
									asChild
									size="sm"
									variant="secondary"
									className="mt-2 w-full"
								>
									<Link to={loaderTyped.nextPath}>
										<ExternalLink className="mr-1 h-3 w-3" />
										Open Publisher to restore draft
									</Link>
								</Button>
							)}
						</AlertDescription>
					</Alert>
				</motion.div>
			)}

			{/* Form-level error */}
			<AnimatePresence>
				{formError && (
					<motion.div
						key="form-error"
						initial={{ opacity: 0, height: 0, marginBottom: 0 }}
						animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
						exit={{ opacity: 0, height: 0, marginBottom: 0 }}
						className="overflow-hidden"
					>
						<Alert variant="destructive" aria-live="assertive">
							<AlertDescription>{formError}</AlertDescription>
						</Alert>
					</motion.div>
				)}
			</AnimatePresence>

			<Form
				method="post"
				action="/sign-up"
				aria-label="Sign up form"
				noValidate
			>
				<AuthenticityTokenInput />
				<input
					type="hidden"
					name="cf-turnstile-response"
					value={turnstileToken ?? ''}
				/>
				{referralData.referrer && (
					<input type="hidden" name="referrer" value={referralData.referrer} />
				)}
				{referralData.utm_source && (
					<input
						type="hidden"
						name="utm_source"
						value={referralData.utm_source}
					/>
				)}

				{/* Name */}
				<motion.div className="mb-4" {...fieldVariants(0)}>
					<label className="mb-2 block text-sm font-medium" htmlFor={nameId}>
						Full Name{' '}
						<span className="text-muted-foreground font-normal">
							(optional)
						</span>
					</label>
					{/* No error slot: an optional field has nothing to reject. */}
					<Input
						id={nameId}
						name="name"
						type="text"
						autoComplete="name"
						placeholder="Jane Smith"
					/>
				</motion.div>

				{/* Email */}
				<motion.div className="mb-4" {...fieldVariants(1)}>
					<label className="mb-2 block text-sm font-medium" htmlFor={emailId}>
						Email
					</label>
					<Input
						id={emailId}
						name="email"
						type="email"
						autoComplete="email"
						placeholder="jane@example.com"
						required
						aria-invalid={!!errors.email}
						aria-describedby={errors.email ? `${emailId}-error` : undefined}
					/>
					<AnimatePresence>
						{errors.email && (
							<motion.p
								id={`${emailId}-error`}
								role="alert"
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: 'auto' }}
								exit={{ opacity: 0, height: 0 }}
								className="text-destructive mt-1 overflow-hidden text-sm"
							>
								{errors.email}
							</motion.p>
						)}
					</AnimatePresence>
				</motion.div>

				{/* Password */}
				<motion.div className="mb-4" {...fieldVariants(2)}>
					<label
						className="mb-2 block text-sm font-medium"
						htmlFor={passwordId}
					>
						Password
					</label>
					<div className="relative">
						<Input
							id={passwordId}
							name="password"
							type={showPassword ? 'text' : 'password'}
							autoComplete="new-password"
							placeholder="At least 8 characters"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							aria-invalid={!!errors.password}
							aria-describedby={
								errors.password ? `${passwordId}-error` : 'password-strength'
							}
							className="pr-10"
						/>
						<button
							type="button"
							aria-label={showPassword ? 'Hide password' : 'Show password'}
							onClick={() => setShowPassword((v) => !v)}
							className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
						>
							{showPassword ? (
								<EyeClosed className="h-4 w-4" />
							) : (
								<Eye className="h-4 w-4" />
							)}
						</button>
					</div>

					{/* Strength bar */}
					<AnimatePresence>
						{password.length > 0 && (
							<motion.div
								id="password-strength"
								aria-live="polite"
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: 'auto' }}
								exit={{ opacity: 0, height: 0 }}
								className="mt-2 overflow-hidden"
							>
								<div className="bg-muted h-1 overflow-hidden rounded-full">
									<motion.div
										className="h-full rounded-full"
										animate={{
											width: `${(strength.score / 3) * 100}%`,
											backgroundColor: strength.barColor
										}}
										transition={{
											type: 'spring',
											stiffness: 300,
											damping: 30
										}}
									/>
								</div>
								{/*
										The bar keeps the saturated hue - it is a non-text mark, so
										the 3:1 floor applies. The label does not: as text on the
										raised panel the saturated tokens land between 1.9:1 and
										3.5:1, all of them short of AA, so it takes the muted
										`-foreground` role instead.
									*/}
								{strength.label && (
									<p className={cn('mt-1 text-xs', strength.labelClass)}>
										{strength.label}
									</p>
								)}
							</motion.div>
						)}
					</AnimatePresence>

					<AnimatePresence>
						{errors.password && (
							<motion.p
								id={`${passwordId}-error`}
								role="alert"
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: 'auto' }}
								exit={{ opacity: 0, height: 0 }}
								className="text-destructive mt-1 overflow-hidden text-sm"
							>
								{errors.password}
							</motion.p>
						)}
					</AnimatePresence>
				</motion.div>

				{/* Confirm password - revealed once password has content */}
				<AnimatePresence>
					{password.length > 0 && (
						<motion.div
							key="confirm-password-field"
							initial={{ opacity: 0, height: 0, marginBottom: 0 }}
							animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
							exit={{ opacity: 0, height: 0, marginBottom: 0 }}
							className="overflow-hidden"
						>
							<label
								className="mb-2 block text-sm font-medium"
								htmlFor={confirmId}
							>
								Confirm Password
							</label>
							<div className="relative">
								<Input
									id={confirmId}
									name="confirm_password"
									type={showConfirm ? 'text' : 'password'}
									autoComplete="new-password"
									placeholder="Repeat your password"
									required
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									aria-invalid={passwordMismatch || !!errors.confirmPassword}
									aria-describedby={
										passwordMismatch || errors.confirmPassword
											? `${confirmId}-error`
											: undefined
									}
									className="pr-10"
								/>
								<button
									type="button"
									aria-label={
										showConfirm
											? 'Hide confirm password'
											: 'Show confirm password'
									}
									onClick={() => setShowConfirm((v) => !v)}
									className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
								>
									{showConfirm ? (
										<EyeClosed className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
							<AnimatePresence>
								{(passwordMismatch || errors.confirmPassword) && (
									<motion.p
										id={`${confirmId}-error`}
										role="alert"
										initial={{ opacity: 0, height: 0 }}
										animate={{ opacity: 1, height: 'auto' }}
										exit={{ opacity: 0, height: 0 }}
										className="text-destructive mt-1 overflow-hidden text-sm"
									>
										{errors.confirmPassword ?? 'Passwords do not match.'}
									</motion.p>
								)}
							</AnimatePresence>
						</motion.div>
					)}
				</AnimatePresence>

				{/* ToS checkbox */}
				<motion.div className="mb-6" {...fieldVariants(3)}>
					<motion.div
						animate={tosShake ? { x: [0, -5, 5, -5, 5, 0] } : {}}
						transition={{ duration: duration.slow, ease: ease.out }}
						className="flex items-start gap-3"
					>
						<Checkbox
							id="tos_accepted"
							name="tos_accepted"
							checked={tosChecked}
							onCheckedChange={(checked) => setTosChecked(!!checked)}
							aria-invalid={!!errors.tos}
							aria-describedby={errors.tos ? 'tos-error' : undefined}
							className="mt-0.5"
						/>
						<label
							htmlFor="tos_accepted"
							className="text-muted-foreground cursor-pointer text-sm leading-snug"
						>
							I agree to the{' '}
							<Link
								to="/terms-of-service"
								target="_blank"
								rel="noopener noreferrer"
								className="text-foreground underline-offset-2 hover:underline"
							>
								Terms of Service
							</Link>{' '}
							and{' '}
							<Link
								to="/privacy-policy"
								target="_blank"
								rel="noopener noreferrer"
								className="text-foreground underline-offset-2 hover:underline"
							>
								Privacy Policy
							</Link>
						</label>
					</motion.div>
					<AnimatePresence>
						{errors.tos && (
							<motion.p
								id="tos-error"
								role="alert"
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: 'auto' }}
								exit={{ opacity: 0, height: 0 }}
								className="text-destructive mt-2 overflow-hidden text-sm"
							>
								{errors.tos}
							</motion.p>
						)}
					</AnimatePresence>
				</motion.div>

				{/* Submit */}
				<motion.div {...fieldVariants(4)}>
					<Button
						type="submit"
						className="w-full font-semibold"
						disabled={isSubmitting || (hasTurnstile && !turnstileToken)}
					>
						{isSubmitting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Creating account…
							</>
						) : (
							<>
								<ShieldCheck className="mr-2 h-4 w-4" />
								Create Account
							</>
						)}
					</Button>
				</motion.div>
			</Form>
		</div>
	)
}

export default SignupPage
