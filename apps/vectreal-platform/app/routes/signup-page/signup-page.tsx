import {
	AlertDescription,
	AlertTitle,
	Alert as BaseAlert
} from '@shared/components/ui/alert'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { ApiResponse } from '@shared/utils'
import { User } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { AnimatePresence } from 'framer-motion'
import { AlertCircle, Eye, EyeClosed, ExternalLink, Save } from 'lucide-react'
import { useState } from 'react'
import { data, Form, Link, redirect, type MetaFunction } from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'

import { Route } from './+types/signup-page'
import { checkAuthRateLimit } from '../../lib/domain/auth/auth-rate-limit.server'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'
import { buildMeta } from '../../lib/seo'
import { createSupabaseClient } from '../../lib/supabase.server'

import type { PostHogContext } from '../../lib/posthog/posthog-middleware'

export const meta: MetaFunction = () =>
	buildMeta(
		[
			{ title: 'Sign Up — Vectreal' },
			{ property: 'og:title', content: 'Sign Up — Vectreal' },
			{
				name: 'description',
				content:
					'Create your free Vectreal account and start publishing 3D content today.'
			}
		],
		undefined,
		{ private: true }
	)

/**
 * User input fields for signup form.
 */
interface UserInput {
	username: string
	email: string
	password: string
}

interface SignupActionData {
	errors?: Record<string, string>
	formError?: string
	errorCode?: 'rate_limited' | 'signup_failed' | 'unknown'
}

const Alert = motion.create(BaseAlert)

const showVariants = {
	hidden: { opacity: 0, y: 10 },
	visible: { opacity: 1, y: 0 }
}

/**
 * Validate signup form data.
 * @param formData FormData from the request
 * @returns errors and sanitized data
 */
function validateSignup(formData: FormData) {
	const errors: Record<string, string> = {}

	const username = formData.get('username')
	const email = formData.get('email')
	const password = formData.get('password')

	if (!username || typeof username !== 'string' || username.length < 3) {
		errors.username = 'Username must be at least 3 characters long.'
	}
	if (!email || typeof email !== 'string' || !email.includes('@')) {
		errors.email = 'Please enter a valid email address.'
	}
	if (!password || typeof password !== 'string' || password.length < 6) {
		errors.password = 'Password must be at least 6 characters long.'
	}

	const data = { username, email, password } as UserInput
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

/**
 * Action handler for signup form submission.
 * Handles user registration via Supabase.
 */
export async function action({ request, context }: Route.ActionArgs) {
	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) {
		return csrfCheck
	}

	const {
		errors,
		data: { email, password, username }
	} = validateSignup(formData)

	const hasErrors = Object.keys(errors).length > 0
	if (hasErrors) {
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
				headers: {
					'Retry-After': String(rateLimitResult.retryAfterSeconds)
				}
			}
		)
	}

	const { client, headers } = await createSupabaseClient(request)
	let signupData: Awaited<ReturnType<typeof client.auth.signUp>>['data']
	let signupError: Awaited<ReturnType<typeof client.auth.signUp>>['error']

	try {
		const response = await client.auth.signUp({
			email,
			password,
			options: { data: { username } }
		})
		signupData = response.data
		signupError = response.error
	} catch (error) {
		console.error('[auth/sign-up] unexpected signup error', {
			error,
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
		const additionalHeaders = new Headers(headers)
		const posthog = (context as PostHogContext).posthog
		posthog?.capture({
			distinctId: signupData.user.id,
			event: 'user_signed_up',
			properties: {
				method: 'email',
				client_type: 'web'
			}
		})

		return ApiResponse.success({ user: signupData.user }, 200, {
			headers: additionalHeaders
		})
	}

	if (signupError) {
		const message = signupError.message.toLowerCase()
		const isKnownClientError =
			message.includes('already registered') ||
			message.includes('invalid') ||
			message.includes('password')

		if (!isKnownClientError) {
			console.error('[auth/sign-up] signup failed', {
				message: signupError.message,
				email: normalizedEmail
			})
		}

		return data<SignupActionData>(
			{
				formError: isKnownClientError
					? 'Unable to create account with the provided details.'
					: 'Unable to create your account right now. Please try again.',
				errorCode: 'signup_failed'
			},
			{ status: isKnownClientError ? 400 : 500, headers }
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

/**
 * Loader for the signup page. Redirects authenticated users.
 */
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
	/** The publisher restore URL embedded in `next`, forwarded to the component for the 'Open Publisher' button. */
	const nextPath = url.searchParams.get('next') ?? null

	return data(
		{
			sceneSaved,
			nextPath,
			user: user ?? null,
			isAuthenticated: !!user,
			message: user ? 'Already authenticated' : null
		},
		{ headers }
	)
}

/**
 * SignupPage component renders the registration form and handles UI state.
 * @param loaderData Loader data from the route
 * @param props Additional props
 */
const SignupPage = ({ loaderData, ...props }: Route.ComponentProps) => {
	const [showPassword, setShowPassword] = useState<boolean>(false)
	const togglePasswordVisibility = () => {
		setShowPassword((prev) => !prev)
	}

	// Extract errors from actionData (now { errors } or undefined)
	const actionData = props.actionData as
		| { user: User }
		| { errors?: Record<string, string>; formError?: string }

	const errors: Record<string, string> =
		typeof actionData === 'object' &&
		actionData !== null &&
		'errors' in actionData
			? (actionData.errors ?? {})
			: {}

	const formError =
		typeof actionData === 'object' &&
		actionData !== null &&
		'formError' in actionData
			? actionData.formError
			: null

	const actionResultData =
		typeof actionData === 'object' &&
		actionData !== null &&
		'data' in actionData
			? (actionData.data as { user: User })
			: null

	const isEmailVerified = actionResultData?.user?.user_metadata?.email_verified

	return (
		<AnimatePresence mode="wait">
			{/* Email verification alert */}
			{isEmailVerified === false && (
				<Alert
					key={isEmailVerified ? 'verified' : 'unverified'}
					variants={showVariants}
					variant="destructive"
					initial="hidden"
					animate="visible"
					exit="hidden"
					className="bg-muted/50 text-accent"
					role="alert"
					aria-live="assertive"
				>
					<AlertCircle className="h-4 w-4" aria-hidden="true" />
					<AlertTitle className="font-medium">
						We've sent you a confirmation email!
					</AlertTitle>
					<AlertDescription className="text-accent! font-light">
						Please verify your email before signing in.
					</AlertDescription>
				</Alert>
			)}

			{/* Scene preservation notice */}
			{loaderData?.sceneSaved && (
				<div className="border-success/50 bg-success/25 text-success-foreground/80 mb-6 space-y-2 rounded-lg border p-4 text-sm">
					<span className="flex gap-2">
						<Save className="h-4 w-4 text-inherit" aria-hidden="true" />
						<p className="font-medium! text-inherit!">
							Scene Saved Temporarily!
						</p>
					</span>
					<p className="text-success-foreground/60!">
						Your scene configuration has been saved. Sign up with Google or
						GitHub to convert to a permanent account and access your scene.
					</p>
					{loaderData.nextPath && (
						<Button
							asChild
							size="sm"
							variant="outline"
							className="border-success/50 text-success-foreground/80 hover:bg-success/20 hover:text-success-foreground mt-1 w-full"
						>
							<Link to={loaderData.nextPath}>
								<ExternalLink className="mr-1 h-3 w-3" />
								Open Publisher to restore draft
							</Link>
						</Button>
					)}
				</div>
			)}

			{formError && (
				<div className="border-error-border bg-error-bg text-error-foreground mb-4 rounded-lg border p-4 text-sm">
					{formError}
				</div>
			)}

			<Form
				className="w-full max-w-md"
				method="post"
				action="/sign-up"
				aria-label="Sign up form"
				noValidate
			>
				<AuthenticityTokenInput />
				<div className="mb-4">
					<label className="mb-2 block text-sm font-medium" htmlFor="username">
						Username
					</label>
					<Input
						name="username"
						autoComplete="username"
						placeholder="your-username"
						type="text"
						id="username"
						className="w-full p-2"
						required
						aria-invalid={!!errors?.username}
						aria-describedby={errors?.username ? 'username-error' : undefined}
					/>
					{errors?.username && (
						<p
							id="username-error"
							className="text-destructive mt-1 text-sm"
							role="alert"
						>
							{errors.username}
						</p>
					)}
				</div>
				<div className="mb-4">
					<label className="mb-2 block text-sm font-medium" htmlFor="email">
						Email
					</label>
					<Input
						name="email"
						autoComplete="email"
						placeholder="example@yay.com"
						type="email"
						id="email"
						className="w-full p-2"
						required
						aria-invalid={!!errors?.email}
						aria-describedby={errors?.email ? 'email-error' : undefined}
					/>
					{errors?.email && (
						<p
							id="email-error"
							className="text-destructive mt-1 text-sm"
							role="alert"
						>
							{errors.email}
						</p>
					)}
				</div>
				<div className="mb-4">
					<label className="mb-2 block text-sm font-medium" htmlFor="password">
						Password
					</label>
					<span className="relative flex w-full items-center">
						<Input
							name="password"
							autoComplete="current-password"
							placeholder="********"
							type={showPassword ? 'text' : 'password'}
							id="password"
							className="w-full p-2"
							required
							aria-invalid={!!errors?.password}
							aria-describedby={errors?.password ? 'password-error' : undefined}
						/>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger
									type="button"
									className="[&_svg]:text-muted-foreground absolute top-0 right-0 p-2 px-3 [&_svg]:h-4 [&_svg]:w-4"
									aria-label={showPassword ? 'Hide password' : 'Show password'}
								>
									<Button
										onClick={togglePasswordVisibility}
										asChild
										type="button"
										size="icon"
										variant="ghost"
									>
										{showPassword ? <EyeClosed /> : <Eye />}
									</Button>
									<TooltipContent>
										{showPassword ? 'Hide password' : 'Show password'}
									</TooltipContent>
								</TooltipTrigger>
							</Tooltip>
						</TooltipProvider>
					</span>
					{errors?.password && (
						<p
							id="password-error"
							className="text-destructive mt-1 text-sm"
							role="alert"
						>
							{errors.password}
						</p>
					)}
				</div>
				<Button type="submit" className="w-full">
					Sign Up
				</Button>
			</Form>
		</AnimatePresence>
	)
}

export default SignupPage
