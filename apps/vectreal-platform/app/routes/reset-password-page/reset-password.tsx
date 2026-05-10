import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { data, redirect, useNavigation, type MetaFunction } from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'

import { Route } from './+types/reset-password'
import { AuthErrorBoundary } from '../../components/errors'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'
import { buildMeta } from '../../lib/seo'
import { createSupabaseClient } from '../../lib/supabase.server'

export { AuthErrorBoundary as ErrorBoundary }

interface ResetPasswordActionData {
	errors?: {
		password?: string
		confirmPassword?: string
	}
	formError?: string
}

const MIN_PASSWORD_LENGTH = 8

export const meta: MetaFunction = () =>
	buildMeta(
		[
			{ title: 'Reset Password — Vectreal' },
			{ property: 'og:title', content: 'Reset Password — Vectreal' }
		],
		undefined,
		{ private: true }
	)

export async function loader({ request }: Route.LoaderArgs) {
	const { client, headers } = await createSupabaseClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()

	if (!user) {
		return redirect('/sign-in?error=session_missing', { headers })
	}

	return data({}, { headers })
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) {
		return csrfCheck
	}

	const passwordValue = formData.get('password')
	const confirmPasswordValue = formData.get('confirmPassword')
	const password = typeof passwordValue === 'string' ? passwordValue : ''
	const confirmPassword =
		typeof confirmPasswordValue === 'string' ? confirmPasswordValue : ''
	const errors: ResetPasswordActionData['errors'] = {}

	if (password.length < MIN_PASSWORD_LENGTH) {
		errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
	}

	if (!confirmPassword || confirmPassword !== password) {
		errors.confirmPassword = 'Passwords do not match.'
	}

	if (errors.password || errors.confirmPassword) {
		return data<ResetPasswordActionData>({ errors }, { status: 400 })
	}

	const { client, headers } = await createSupabaseClient(request)
	const { error } = await client.auth.updateUser({ password })

	if (error) {
		return data<ResetPasswordActionData>(
			{ formError: 'Unable to reset password right now. Please try again.' },
			{ status: 500, headers }
		)
	}

	return redirect('/sign-in', { headers })
}

export default function ResetPasswordPage({
	actionData
}: Route.ComponentProps) {
	const navigation = useNavigation()
	const isSubmitting = navigation.state === 'submitting'
	const errors = actionData?.errors
	const formError = actionData?.formError

	return (
		<div className="w-full max-w-md">
			<h1 className="mb-2 text-2xl font-semibold">Set a new password</h1>
			<p className="text-muted-foreground mb-8 text-sm leading-relaxed">
				Choose a new password for your account.
			</p>

			<form method="post" className="space-y-4">
				<AuthenticityTokenInput />

				{formError && (
					<div
						className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm"
						role="alert"
						aria-live="assertive"
					>
						{formError}
					</div>
				)}

				<div>
					<label htmlFor="password" className="mb-2 block text-sm font-medium">
						New password
					</label>
					<Input
						id="password"
						name="password"
						type="password"
						autoComplete="new-password"
						required
					/>
					{errors?.password && (
						<p className="text-destructive mt-1 text-sm">{errors.password}</p>
					)}
				</div>

				<div>
					<label
						htmlFor="confirmPassword"
						className="mb-2 block text-sm font-medium"
					>
						Confirm new password
					</label>
					<Input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						autoComplete="new-password"
						required
					/>
					{errors?.confirmPassword && (
						<p className="text-destructive mt-1 text-sm">
							{errors.confirmPassword}
						</p>
					)}
				</div>

				<Button type="submit" className="w-full" disabled={isSubmitting}>
					{isSubmitting ? 'Saving…' : 'Save new password'}
				</Button>
			</form>
		</div>
	)
}
