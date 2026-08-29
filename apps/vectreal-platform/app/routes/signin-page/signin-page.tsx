import {
	Alert,
	AlertDescription,
	AlertTitle
} from '@shared/components/ui/alert'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { AnimatePresence, motion, Variants } from 'framer-motion'
import { Eye, EyeClosed, ExternalLink, Save } from 'lucide-react'
import { useState } from 'react'
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

import { Route } from './+types/signin-page'
import { captureServerEvent } from '../../lib/domain/analytics/server-events.server'
import {
	AUTH_ERROR_MESSAGES,
	classifySigninFailure,
	type AuthErrorCode
} from '../../lib/domain/auth/signin-failure'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'
import { recordRateLimitAttempt } from '../../lib/http/rate-limit.server'
import { duration, ease, STAGGER_STEP } from '../../lib/motion/motion-tokens'
import { reportServerError } from '../../lib/observability/report-server-error.server'
import { buildMeta } from '../../lib/seo'
import { createSupabaseClient } from '../../lib/supabase.server'

import type { PostHogContext } from '../../lib/posthog/posthog-middleware'
import type { AuthLayoutContext } from '../layouts/signin-layout'

interface SigninActionData {
	errors?: Record<string, string>
	formError?: string
	errorCode?: AuthErrorCode
}

export const meta: MetaFunction = () =>
	buildMeta(
		[
			{ title: 'Sign In - Vectreal' },
			{ property: 'og:title', content: 'Sign In - Vectreal' },
			{
				name: 'description',
				content: 'Sign in to your Vectreal account to manage your 3D content.'
			}
		],
		undefined,
		{ private: true }
	)

interface UserInput {
	email: string
	password: string
}

function validateSignin(formData: FormData) {
	const errors: Record<string, string> = {}

	const email = formData.get('email')
	const password = formData.get('password')

	if (!email || typeof email !== 'string' || !email.includes('@')) {
		errors.email = 'Please enter a valid email address.'
	}
	if (!password || typeof password !== 'string' || password.length < 6) {
		errors.password = 'Password must be at least 6 characters long.'
	}

	const data = { email, password } as UserInput
	return { errors, data }
}

const getSafeNext = (request: Request) => {
	const requestUrl = new URL(request.url)
	const next = requestUrl.searchParams.get('next')

	if (!next || !next.startsWith('/')) {
		return '/dashboard'
	}

	return next
}

export async function action({ request, context }: Route.ActionArgs) {
	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) {
		return csrfCheck
	}

	const {
		errors,
		data: { email, password }
	} = validateSignin(formData)

	const hasErrors = Object.keys(errors).length > 0
	if (hasErrors) {
		return data<SigninActionData>({ errors }, { status: 400 })
	}

	const normalizedEmail = email.trim().toLowerCase()
	const rateLimitResult = recordRateLimitAttempt(request, {
		bucket: 'auth-signin',
		maxRequests: 10,
		keyParts: [normalizedEmail]
	})

	if (rateLimitResult.limited) {
		return data<SigninActionData>(
			{
				formError: AUTH_ERROR_MESSAGES.rate_limited,
				errorCode: 'rate_limited'
			},
			{
				status: 429,
				headers: {
					'Retry-After': String(rateLimitResult.retryAfterSeconds)
				}
			}
		)
	}

	const turnstileToken = formData.get('cf-turnstile-response')
	const captchaToken =
		typeof turnstileToken === 'string' ? turnstileToken : undefined

	const { client, headers } = await createSupabaseClient(request)
	let authData: Awaited<
		ReturnType<typeof client.auth.signInWithPassword>
	>['data']
	let authError: Awaited<
		ReturnType<typeof client.auth.signInWithPassword>
	>['error']

	try {
		const response = await client.auth.signInWithPassword({
			email,
			password,
			options: { captchaToken }
		})
		authData = response.data
		authError = response.error
	} catch (error) {
		reportServerError(error, { request })
		return data<SigninActionData>(
			{
				formError: AUTH_ERROR_MESSAGES.unknown,
				errorCode: 'unknown'
			},
			{ status: 500, headers }
		)
	}

	if (authData?.user && authData.session) {
		const posthog = (context as PostHogContext).posthog
		captureServerEvent(posthog, request, authData.user.id, {
			name: 'user_signed_in',
			props: { method: 'email' }
		})

		const additionalHeaders = new Headers(headers)
		const next = getSafeNext(request)

		return redirect(next, {
			headers: additionalHeaders
		})
	}

	if (authError) {
		const failure = classifySigninFailure(authError.message)

		if (failure.report) {
			reportServerError(authError, {
				request,
				properties: {
					signin_failure_code: failure.code,
					supabase_message: authError.message
				}
			})
		}

		/*
		  The one failure with a screen that can fix it. GoTrue only reports a
		  missing confirmation once the password has already checked out, so this
		  redirect cannot tell a stranger anything - and the resend gate was
		  otherwise reachable only from a successful sign-up, which is no help to
		  someone whose confirmation email never arrived.
		*/
		if (failure.code === 'email_not_confirmed') {
			const confirmPendingUrl = new URL(
				'/auth/confirm-pending',
				new URL(request.url).origin
			)
			confirmPendingUrl.searchParams.set('email', normalizedEmail)
			return redirect(confirmPendingUrl.toString(), {
				headers: new Headers(headers)
			})
		}

		return data<SigninActionData>(
			{ formError: failure.message, errorCode: failure.code },
			{ status: failure.status, headers }
		)
	}

	return data<SigninActionData>(
		{
			formError: AUTH_ERROR_MESSAGES.unknown,
			errorCode: 'unknown'
		},
		{ status: 500, headers }
	)
}

export const loader = async ({ request }: Route.LoaderArgs) => {
	const { client, headers } = await createSupabaseClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()

	if (user) {
		return redirect(getSafeNext(request), { headers })
	}

	// Check if this is a scene preservation flow
	const url = new URL(request.url)
	const sceneSaved = url.searchParams.get('scene_saved') === 'true'
	const rawAuthError = url.searchParams.get('error')
	const authErrorCode =
		rawAuthError && rawAuthError in AUTH_ERROR_MESSAGES
			? (rawAuthError as AuthErrorCode)
			: null
	/** The publisher restore URL embedded in `next`, forwarded to the component for the 'Open Publisher' button. */
	const nextPath = url.searchParams.get('next') ?? null

	return data(
		{
			sceneSaved,
			authErrorCode,
			authErrorMessage: authErrorCode
				? AUTH_ERROR_MESSAGES[authErrorCode]
				: null,
			nextPath,
			user: user ?? null,
			isAuthenticated: !!user,
			message: user ? 'Already authenticated' : null
		},
		{ headers }
	)
}

const SigninPage = ({ actionData, loaderData }: Route.ComponentProps) => {
	const navigation = useNavigation()
	const [showPassword, setShowPassword] = useState(false)

	const typedActionData = actionData as SigninActionData | undefined
	const errors = typedActionData?.errors
	const formError =
		typedActionData?.formError ?? loaderData?.authErrorMessage ?? null

	const { turnstileToken, hasTurnstile } = useOutletContext<AuthLayoutContext>()

	const isSubmitting = navigation.state === 'submitting'

	const fieldVariants: Variants = {
		hidden: { opacity: 0, y: 8 },
		visible: (i: number) => ({
			opacity: 1,
			y: 0,
			transition: {
				delay: i * STAGGER_STEP,
				duration: duration.base,
				ease: ease.out
			}
		})
	}

	return (
		<div className="w-full max-w-md">
			{/* Animated error banner */}
			<AnimatePresence mode="wait">
				{formError && (
					<motion.div
						key={formError}
						initial={{ opacity: 0, y: -6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={{ duration: duration.fast, ease: ease.out }}
						className="mb-6"
					>
						<Alert variant="destructive" aria-live="assertive">
							<AlertDescription>{formError}</AlertDescription>
						</Alert>
					</motion.div>
				)}
			</AnimatePresence>

			{loaderData?.sceneSaved && (
				<Alert variant="success" role="status" className="mb-6">
					<Save aria-hidden="true" />
					<AlertTitle>Scene saved temporarily</AlertTitle>
					<AlertDescription>
						<p>
							Your scene configuration has been saved. Sign up with Google or
							GitHub to convert to a permanent account and access your scene.
						</p>
						{loaderData.nextPath && (
							<Button
								asChild
								size="sm"
								variant="outline"
								className="mt-2 w-full"
							>
								<Link to={loaderData.nextPath}>
									<ExternalLink className="mr-1 h-3 w-3" />
									Open Publisher to restore draft
								</Link>
							</Button>
						)}
					</AlertDescription>
				</Alert>
			)}

			<Form className="w-full" method="post" action="/sign-in">
				<AuthenticityTokenInput />
				<input
					type="hidden"
					name="cf-turnstile-response"
					value={turnstileToken ?? ''}
				/>

				{/* Email */}
				<motion.div
					className="mb-4"
					custom={0}
					variants={fieldVariants}
					initial="hidden"
					animate="visible"
				>
					<label className="mb-2 block text-sm font-medium" htmlFor="email">
						Email
					</label>
					<Input
						name="email"
						placeholder="example@yay.com"
						autoComplete="email"
						type="email"
						id="email"
						className="w-full p-2"
						required
					/>
					{errors?.email && (
						<p className="text-destructive mt-1 text-sm">{errors.email}</p>
					)}
				</motion.div>

				{/* Password */}
				<motion.div
					className="mb-1"
					custom={1}
					variants={fieldVariants}
					initial="hidden"
					animate="visible"
				>
					<label className="mb-2 block text-sm font-medium" htmlFor="password">
						Password
					</label>
					<span className="relative flex w-full items-center">
						<Input
							name="password"
							autoComplete="current-password"
							placeholder="••••••••"
							type={showPassword ? 'text' : 'password'}
							id="password"
							className="w-full p-2 pr-10"
							required
						/>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										onClick={() => setShowPassword((p) => !p)}
										aria-label={
											showPassword ? 'Hide password' : 'Show password'
										}
										className="text-muted-foreground hover:text-foreground absolute top-0 right-0 flex h-full items-center px-3 transition-colors"
									>
										{showPassword ? (
											<EyeClosed className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
								</TooltipTrigger>
								<TooltipContent>
									{showPassword ? 'Hide password' : 'Show password'}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</span>
					{errors?.password && (
						<p className="text-destructive mt-1 text-sm">{errors.password}</p>
					)}
				</motion.div>

				{/* Forgot password */}
				<motion.div
					className="mb-6 flex justify-end"
					custom={2}
					variants={fieldVariants}
					initial="hidden"
					animate="visible"
				>
					<Link
						to="/forgot-password"
						className="text-muted-foreground hover:text-foreground text-xs transition-colors"
					>
						Forgot password?
					</Link>
				</motion.div>

				{/* Submit */}
				<motion.div
					custom={3}
					variants={fieldVariants}
					initial="hidden"
					animate="visible"
				>
					<Button
						type="submit"
						className="w-full"
						disabled={isSubmitting || (hasTurnstile && !turnstileToken)}
					>
						{isSubmitting ? 'Signing in…' : 'Sign In'}
					</Button>
				</motion.div>
			</Form>
		</div>
	)
}

export default SigninPage
