import { User } from '@supabase/supabase-js'
import { Button } from '@vctrl-ui/ui/button'
import { Input } from '@vctrl-ui/ui/input'

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '@vctrl-ui/ui/tooltip'
import { ApiResponse } from '@vctrl-ui/utils'
import { Eye, EyeClosed } from 'lucide-react'
import { useState } from 'react'
import { data, Form, redirect } from 'react-router'

import { createClient } from '../../lib/supabase.server'

import { Route } from './+types/signup-page'

interface UserInput {
	username: string
	email: string
	password: string
}

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

	const { client, headers } = await createClient(request)
	const { data: signupData, error } = await client.auth.signUp({
		email,
		password,
		options: { data: { username } }
	})

	if (signupData?.user) {
		return ApiResponse.success({ user: signupData.user }, 200, { headers })
	}

	return ApiResponse.serverError(
		error?.message || 'An error occurred during signup'
	)
}

export const loader = async ({ request }: Route.LoaderArgs) => {
	const { client } = await createClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()

	if (user) return redirect('/dashboard')

	// Return a consistent schema for the loader
	return {
		user: user ?? null,
		isAuthenticated: !!user,
		message: user ? 'Already authenticated' : null
	}
}

const SignupPage = ({ loaderData, ...props }: Route.ComponentProps) => {
	const [showPassword, setShowPassword] = useState(false)
	const togglePasswordVisibility = () => {
		setShowPassword((prev) => !prev)
	}

	// Extract errors from actionData (now { errors } or undefined)
	const actionData = props.actionData as
		| { user: User }
		| { errors?: Record<string, string> }

	const errors =
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

	const verified = actionResultData?.user?.user_metadata.email_verified
	console.log('SignupPage actionResultUser:', actionResultData)
	console.log('SignupPage verified:', verified)

	return (
		<Form className="w-full max-w-md" method="post" action="/sign-up">
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
				/>
				{errors?.username && (
					<p className="text-destructive mt-1 text-sm">{errors.username}</p>
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
				/>
				{errors?.email && (
					<p className="text-destructive mt-1 text-sm">{errors.email}</p>
				)}
			</div>
			<div className="mb-4">
				<label className="mb-2 block text-sm font-medium" htmlFor="password">
					Password
				</label>
				<span className="relative w-full">
					<Input
						name="password"
						placeholder="********"
						type={showPassword ? 'text' : 'password'}
						id="password"
						className="w-full p-2"
						required
					/>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger
								type="button"
								className="[&_svg]:text-muted-foreground absolute top-1/2 right-0 -translate-y-1/2 p-2 px-3 [&_svg]:h-4 [&_svg]:w-4"
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
					<p className="text-destructive mt-1 text-sm">{errors.password}</p>
				)}
			</div>
			<Button type="submit" className="w-full">
				Sign Up
			</Button>
		</Form>
	)
}

export default SignupPage
