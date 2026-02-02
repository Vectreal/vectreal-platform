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
import { AlertCircle, Eye, EyeClosed } from 'lucide-react'
import { useState } from 'react'

import { data, Form, redirect } from 'react-router'

import { createSupabaseClient } from '../../lib/supabase.server'

import { Route } from './+types/signup-page'

/**
 * User input fields for signup form.
 */
interface UserInput {
	username: string
	email: string
	password: string
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

/**
 * Action handler for signup form submission.
 * Handles user registration via Supabase.
 */
export async function action({
	request
}: Route.ActionArgs): Promise<ApiResponse> {
	const formData = await request.formData()
	const {
		errors,
		data: { email, password, username }
	} = validateSignup(formData)

	const hasErrors = Object.keys(errors).length > 0
	if (hasErrors) return data({ errors })

	const { client, headers } = await createSupabaseClient(request)
	const { data: signupData, error } = await client.auth.signUp({
		email,
		password,
		options: { data: { username } }
	})

	if (signupData?.user) {
		const additionalHeaders = new Headers(headers)
		return ApiResponse.success({ user: signupData.user }, 200, {
			headers: additionalHeaders
		})
	}

	return ApiResponse.serverError(
		error?.message || 'An error occurred during signup'
	)
}

/**
 * Loader for the signup page. Redirects authenticated users.
 */
export const loader = async ({ request }: Route.LoaderArgs) => {
	const { client } = await createSupabaseClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()

	if (user) {
		// Default redirect
		return redirect('/dashboard')
	}

	// Check if this is a scene preservation flow
	const url = new URL(request.url)
	const sceneSaved = url.searchParams.get('scene_saved') === 'true'

	return {
		sceneSaved,
		user: user ?? null,
		isAuthenticated: !!user,
		message: user ? 'Already authenticated' : null
	}
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
		| { errors?: Record<string, string> }

	const errors: Record<string, string> =
		typeof actionData === 'object' &&
		actionData !== null &&
		'errors' in actionData
			? (actionData.errors ?? {})
			: {}

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
						Email Verification Required
					</AlertTitle>
					<AlertDescription className="text-accent! font-light">
						Please verify your email before signing in.
					</AlertDescription>
				</Alert>
			)}

			{/* Scene preservation notice */}
			{loaderData?.sceneSaved && (
				<div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
					<p className="font-medium">
						<span role="img" aria-label="celebration">
							🎉
						</span>{' '}
						Scene Saved Temporarily!
					</p>
					<p>
						Your scene configuration has been saved. Sign up with Google or
						GitHub to convert to a permanent account and access your scene.
					</p>
				</div>
			)}

			<Form
				className="w-full max-w-md"
				method="post"
				action="/sign-up"
				aria-label="Sign up form"
				noValidate
			>
				<div className="mb-4">
					<label className="mb-2 block text-sm font-medium" htmlFor="username">
						Username
					</label>
					<Input
						name="username"
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
