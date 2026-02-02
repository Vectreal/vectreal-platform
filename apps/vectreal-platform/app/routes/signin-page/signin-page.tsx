import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { ApiResponse } from '@shared/utils'
import { Eye, EyeClosed } from 'lucide-react'
import { useState } from 'react'
import { Form, redirect } from 'react-router'

import { createSupabaseClient } from '../../lib/supabase.server'

import { Route } from './+types/signin-page'

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

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData()
	const {
		errors,
		data: { email, password }
	} = validateSignin(formData)

	const hasErrors = Object.keys(errors).length > 0
	if (hasErrors) return { errors }

	const { client, headers } = await createSupabaseClient(request)
	const { data, error } = await client.auth.signInWithPassword({
		email,
		password
	})

	if (data?.user && data.session) {
		const additionalHeaders = new Headers(headers)

		// Default redirect to dashboard
		return redirect('/dashboard', {
			headers: additionalHeaders
		})
	}

	if (error) {
		return ApiResponse.serverError(error.message)
	}
}

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

const SigninPage = ({ actionData, loaderData }: Route.ComponentProps) => {
	const [showPassword, setShowPassword] = useState(false)
	const togglePasswordVisibility = () => {
		setShowPassword((prev) => !prev)
	}

	const errors = actionData?.errors

	return (
		<div className="w-full max-w-md">
			{loaderData?.sceneSaved && (
				<div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
					<p className="font-medium">
						<span role="img" aria-label="celebration">
							🎉
						</span>{' '}
						Scene Saved Temporarily!
					</p>
					<p>
						Your scene configuration has been saved. Sign in with Google or
						GitHub to convert to a permanent account and access your scene.
					</p>
				</div>
			)}

			<Form className="w-full" method="post" action="/sign-in">
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
					<span className="relative flex w-full items-center">
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
									className="[&_svg]:text-muted-foreground absolute top-0 right-0 p-2 px-3 [&_svg]:h-4 [&_svg]:w-4"
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
					Sign In
				</Button>
			</Form>
		</div>
	)
}

export default SigninPage
