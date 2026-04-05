import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { ApiResponse } from '@shared/utils'
import { Eye, EyeClosed, ExternalLink, Save } from 'lucide-react'
import { useState } from 'react'
import { data, Form, Link, redirect, type MetaFunction } from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'

import { Route } from './+types/signin-page'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'
import { buildMeta } from '../../lib/seo'
import { createSupabaseClient } from '../../lib/supabase.server'

export const meta: MetaFunction = () =>
	buildMeta(
		[
			{ title: 'Sign In — Vectreal' },
			{ property: 'og:title', content: 'Sign In — Vectreal' },
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

export async function action({ request }: Route.ActionArgs) {
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
	if (hasErrors) return { errors }

	const { client, headers } = await createSupabaseClient(request)
	const { data, error } = await client.auth.signInWithPassword({
		email,
		password
	})

	if (data?.user && data.session) {
		const additionalHeaders = new Headers(headers)
		const next = getSafeNext(request)

		return redirect(next, {
			headers: additionalHeaders
		})
	}

	if (error) {
		return ApiResponse.serverError(error.message)
	}
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

const SigninPage = ({ actionData, loaderData }: Route.ComponentProps) => {
	const [showPassword, setShowPassword] = useState(false)
	const togglePasswordVisibility = () => {
		setShowPassword((prev) => !prev)
	}

	const errors = actionData?.errors

	return (
		<div className="w-full max-w-md">
			{loaderData?.sceneSaved && (
				<div className="mb-6 space-y-2 rounded-lg border border-green-300/50 bg-green-300/25 p-4 text-sm text-green-200/80">
					<span className="flex gap-2">
						<Save className="h-4 w-4 text-inherit" aria-hidden="true" />
						<p className="font-medium! text-inherit!">
							Scene Saved Temporarily!
						</p>
					</span>
					<p className="text-green-200/60!">
						Your scene configuration has been saved. Sign up with Google or
						GitHub to convert to a permanent account and access your scene.
					</p>
					{loaderData.nextPath && (
						<Button
							asChild
							size="sm"
							variant="outline"
							className="mt-1 w-full border-green-300/50 text-green-200/80 hover:bg-green-300/20 hover:text-green-100"
						>
							<Link to={loaderData.nextPath}>
								<ExternalLink className="mr-1 h-3 w-3" />
								Open Publisher to restore draft
							</Link>
						</Button>
					)}
				</div>
			)}

			<Form className="w-full" method="post" action="/sign-in">
				<AuthenticityTokenInput />
				<div className="mb-4">
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
