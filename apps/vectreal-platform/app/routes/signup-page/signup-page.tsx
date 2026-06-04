import { Button } from '@shared/components/ui/button'
import { Checkbox } from '@shared/components/ui/checkbox'
import { Input } from '@shared/components/ui/input'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
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
import { getReferralAttribution } from '../../lib/analytics/referral-attribution'
import { captureServerEvent } from '../../lib/domain/analytics/server-events.server'
import { checkAuthRateLimit } from '../../lib/domain/auth/auth-rate-limit.server'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'
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
	errors?: Record<string, string>
	formError?: string
	errorCode?: 'rate_limited' | 'signup_failed' | 'unknown'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getSafeNext = (request: Request) => {
	const url = new URL(request.url)
	const next = url.searchParams.get('next')
	if (!next || !next.startsWith('/')) return '/dashboard'
	return next
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateSignup(formData: FormData) {
	const errors: Record<string, string> = {}

	const name = formData.get('name')
	const email = formData.get('email')
	const password = formData.get('password')
	const confirmPassword = formData.get('confirm_password')
	const tosAccepted = formData.get('tos_accepted')

	if (!name || typeof name !== 'string' || name.trim().length < 2) {
		errors.name = 'Please enter your name (at least 2 characters).'
	}
	if (!email || typeof email !== 'string' || !email.includes('@')) {
		errors.email = 'Please enter a valid email address.'
	}
	if (!password || typeof password !== 'string' || password.length < 8) {
		errors.password = 'Password must be at least 8 characters long.'
	}
	if (
		!confirmPassword ||
		typeof confirmPassword !== 'string' ||
		confirmPassword !== password
	) {
		errors.confirmPassword = 'Passwords do not match.'
	}
	if (!tosAccepted || tosAccepted !== 'on') {
		errors.tos =
			'You must accept the Terms of Service and Privacy Policy to create an account.'
	}

	return {
		errors,
		data: {
			name: typeof name === 'string' ? name.trim() : '',
			email: typeof email === 'string' ? email : '',
			password: typeof password === 'string' ? password : ''
		}
	}
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
	const rateLimitResult = checkAuthRateLimit(request, {
		bucket: 'auth-signup',
		maxRequests: 5,
		keyParts: [normalizedEmail]
	})

	if (rateLimitResult.limited) {
		return data<SignupActionData>(
			{
				formError: 'Too many sign-up attempts. Please try again shortly.',
				errorCode: 'rate_limited'
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
				data: { name, tos_accepted_at: tosAcceptedAt },
				captchaToken,
				emailRedirectTo: confirmUrl.toString()
			}
		})
		signupData = response.data
		signupError = response.error
	} catch (err) {
		console.error('[auth/sign-up] unexpected error', {
			err,
			email: normalizedEmail
		})
		return data<SignupActionData>(
			{
				formError: 'Unable to create your account right now. Please try again.',
				errorCode: 'unknown'
			},
			{ status: 500, headers }
		)
	}

	if (signupData?.user) {
		// If Supabase already confirmed the user (local dev with enable_confirmations=false),
		// skip the confirm-pending gate and go straight to onboarding.
		if (signupData.user.email_confirmed_at) {
			const posthog = (context as PostHogContext).posthog
			captureServerEvent(posthog, signupData.user.id, {
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
		const message = signupError.message.toLowerCase()
		const captchaFailed =
			message.includes('captcha') || message.includes('turnstile')
		const isClientError =
			captchaFailed ||
			message.includes('already registered') ||
			message.includes('invalid') ||
			message.includes('password')

		if (!isClientError) {
			console.error('[auth/sign-up] signup failed', {
				message: signupError.message,
				email: normalizedEmail
			})
		}

		return data<SignupActionData>(
			{
				formError: isClientError
					? 'Unable to create account with the provided details.'
					: 'Unable to create your account right now. Please try again.',
				errorCode: 'signup_failed'
			},
			{ status: isClientError ? 400 : 500, headers }
		)
	}

	return data<SignupActionData>(
		{
			formError: 'Unable to create your account right now. Please try again.',
			errorCode: 'unknown'
		},
		{ status: 500, headers }
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
	const sceneSaved = url.searchParams.get('scene_saved') === 'true'
	const nextPath = url.searchParams.get('next') ?? null

	return data({ sceneSaved, nextPath }, { headers })
}

// ─── Password strength helper ─────────────────────────────────────────────────

function getPasswordStrength(password: string): {
	score: number
	label: string
	color: string
} {
	if (!password) return { score: 0, label: '', color: '' }
	let score = 0
	// Length is the primary factor (NIST guidelines weight it most heavily)
	if (password.length >= 8) score++
	if (password.length >= 12) score += 2
	if (password.length >= 16) score++
	// Complexity adds secondary score
	if (/[A-Z]/.test(password)) score++
	if (/[0-9]/.test(password)) score++
	if (/[^a-zA-Z0-9]/.test(password)) score++
	if (score <= 2) return { score: 1, label: 'Weak', color: '#ef4444' }
	if (score <= 4) return { score: 2, label: 'Fair', color: '#f59e0b' }
	return { score: 3, label: 'Strong', color: '#22c55e' }
}

// ─── Motion config ────────────────────────────────────────────────────────────

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number]

function fieldVariants(delay: number) {
	return {
		initial: { opacity: 0, y: 8 },
		animate: {
			opacity: 1,
			y: 0,
			transition: { duration: 0.25, delay, ease }
		}
	}
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

	const { turnstileToken, resetTurnstile, hasTurnstile } =
		useOutletContext<AuthLayoutContext>()

	useEffect(() => {
		setReferralData(getReferralAttribution())
	}, [])

	const nameId = useId()
	const emailId = useId()
	const passwordId = useId()
	const confirmId = useId()

	const errors: Record<string, string> =
		actionData && 'errors' in actionData ? (actionData.errors ?? {}) : {}
	const formError =
		actionData && 'formError' in actionData
			? (actionData.formError ?? null)
			: null

	const strength = getPasswordStrength(password)
	const passwordMismatch =
		confirmPassword.length > 0 && confirmPassword !== password

	const loaderTyped = loaderData as {
		sceneSaved: boolean
		nextPath: string | null
	}

	useEffect(() => {
		if (!actionData) return
		resetTurnstile()
		if ('errors' in actionData && actionData.errors?.tos) {
			setTosShake(true)
			setTimeout(() => setTosShake(false), 500)
		}
	}, [actionData, resetTurnstile])

	return (
		<MotionConfig reducedMotion="user">
			<div className="w-full max-w-md">
				{/* Scene preservation notice */}
				{loaderTyped?.sceneSaved && (
					<motion.div
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						className="border-success/50 bg-success/25 text-success-foreground/80 mb-6 space-y-2 rounded-lg border p-4 text-sm"
					>
						<span className="flex gap-2">
							<Save className="h-4 w-4 text-inherit" aria-hidden="true" />
							<p className="font-medium text-inherit">
								Scene Saved Temporarily!
							</p>
						</span>
						<p className="text-success-foreground/60">
							Your scene has been saved. Create an account to make it permanent.
						</p>
						{loaderTyped.nextPath && (
							<Button
								asChild
								size="sm"
								variant="outline"
								className="border-success/50 text-success-foreground/80 hover:bg-success/20 mt-1 w-full"
							>
								<Link to={loaderTyped.nextPath}>
									<ExternalLink className="mr-1 h-3 w-3" />
									Open Publisher to restore draft
								</Link>
							</Button>
						)}
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
							className="border-destructive/50 bg-destructive/10 text-destructive overflow-hidden rounded-lg border p-4 text-sm"
							role="alert"
							aria-live="assertive"
						>
							{formError}
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
						<input
							type="hidden"
							name="referrer"
							value={referralData.referrer}
						/>
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
							Full Name
						</label>
						<Input
							id={nameId}
							name="name"
							type="text"
							autoComplete="name"
							placeholder="Jane Smith"
							required
							aria-invalid={!!errors.name}
							aria-describedby={errors.name ? `${nameId}-error` : undefined}
						/>
						<AnimatePresence>
							{errors.name && (
								<motion.p
									id={`${nameId}-error`}
									role="alert"
									initial={{ opacity: 0, height: 0 }}
									animate={{ opacity: 1, height: 'auto' }}
									exit={{ opacity: 0, height: 0 }}
									className="text-destructive mt-1 overflow-hidden text-sm"
								>
									{errors.name}
								</motion.p>
							)}
						</AnimatePresence>
					</motion.div>

					{/* Email */}
					<motion.div className="mb-4" {...fieldVariants(0.05)}>
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
					<motion.div className="mb-4" {...fieldVariants(0.1)}>
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
												backgroundColor: strength.color
											}}
											transition={{
												type: 'spring',
												stiffness: 300,
												damping: 30
											}}
										/>
									</div>
									{strength.label && (
										<p
											className="mt-1 text-xs"
											style={{ color: strength.color }}
										>
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
					<motion.div className="mb-6" {...fieldVariants(0.15)}>
						<motion.div
							animate={tosShake ? { x: [0, -5, 5, -5, 5, 0] } : {}}
							transition={{ duration: 0.35 }}
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
									to="/legal/terms"
									target="_blank"
									rel="noopener noreferrer"
									className="text-foreground underline-offset-2 hover:underline"
								>
									Terms of Service
								</Link>{' '}
								and{' '}
								<Link
									to="/legal/privacy"
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
					<motion.div {...fieldVariants(0.2)}>
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
		</MotionConfig>
	)
}

export default SignupPage
