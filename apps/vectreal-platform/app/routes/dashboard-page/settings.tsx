import { zodResolver } from '@hookform/resolvers/zod'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage
} from '@shared/components/ui/form'
import { Input } from '@shared/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { AlertTriangle, Save, Settings2, Shield, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { data, Form as RemixForm, redirect, useSubmit } from 'react-router'
import {
	AuthenticityTokenInput,
	useAuthenticityToken
} from 'remix-utils/csrf/react'
import { toast } from 'sonner'
import { z, ZodError } from 'zod'

import { Route } from './+types/settings'
import { useConsent } from '../../components/consent/consent-context'
import { WrittenConfirmationModal } from '../../components/shared/written-confirmation-modal'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import { cancelStripeSubscriptionsForOrganization } from '../../lib/domain/billing/stripe-subscription-sync.server'
import {
	deleteUserAndRelatedData,
	updateUserProfile
} from '../../lib/domain/user/user-repository.server'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'
import {
	commitSession,
	getSession,
	getThemeModeFromRequest
} from '../../lib/sessions/theme-session.server'
import { createSupabaseClient } from '../../lib/supabase.server'

import type { SettingsLoaderData } from '../../lib/domain/dashboard/dashboard-types'

const profileSettingsSchema = z.object({
	name: z
		.string()
		.min(1, 'Name is required')
		.min(2, 'Name must be at least 2 characters')
		.max(120, 'Name must be less than 120 characters')
})

const preferencesSchema = z.object({
	themeMode: z.enum(['system', 'light', 'dark'])
})

const accountDeletionSchema = z.object({
	confirmationText: z.literal('DELETE MY ACCOUNT', {
		errorMap: () => ({
			message: 'Type DELETE MY ACCOUNT to confirm account deletion.'
		})
	})
})

type ProfileFormValues = z.infer<typeof profileSettingsSchema>

type SettingsActionData = {
	error?: string
	success?: boolean
	message?: string
	intent?: string
	themeMode?: 'system' | 'light' | 'dark'
	fieldErrors?: Record<string, string>
}

type ThemeModeValue = 'system' | 'light' | 'dark'

function applyThemeMode(mode: 'system' | 'light' | 'dark') {
	if (typeof document === 'undefined') {
		return
	}

	const pathname = window.location.pathname
	const forceDarkTheme = pathname === '/' || pathname === '/home'
	const prefersDark =
		typeof window !== 'undefined' &&
		window.matchMedia('(prefers-color-scheme: dark)').matches
	const shouldUseDark =
		forceDarkTheme || mode === 'dark' || (mode === 'system' && prefersDark)

	const root = document.documentElement
	root.classList.toggle('dark', shouldUseDark)
	root.style.colorScheme = shouldUseDark ? 'dark' : 'light'
}

export async function loader({ request }: Route.LoaderArgs) {
	const { user, userWithDefaults, headers } =
		await loadAuthenticatedUser(request)
	const themeMode = await getThemeModeFromRequest(request)

	const loaderData: SettingsLoaderData = {
		user,
		userWithDefaults,
		themeMode
	}

	return data(loaderData, { headers })
}

export async function action({ request }: Route.ActionArgs) {
	const { user, userWithDefaults, headers } =
		await loadAuthenticatedUser(request)
	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) {
		return csrfCheck
	}

	const intent = String(formData.get('intent') ?? '')

	try {
		if (intent === 'profile') {
			const validated = profileSettingsSchema.parse({
				name: formData.get('name')
			})

			const updatedUser = await updateUserProfile(user.id, {
				name: validated.name
			})

			return data(
				{
					success: true,
					intent,
					message: 'Profile updated successfully.',
					user: updatedUser
				},
				{ headers }
			)
		}

		if (intent === 'preferences') {
			const validated = preferencesSchema.parse({
				themeMode: formData.get('themeMode')
			})

			const themeSession = await getSession(request.headers.get('Cookie'))
			themeSession.set('themeMode', validated.themeMode)

			const responseHeaders = new Headers(headers)
			responseHeaders.append('Set-Cookie', await commitSession(themeSession))

			return data(
				{
					success: true,
					intent,
					message: 'Preferences saved successfully.',
					themeMode: validated.themeMode
				},
				{ headers: responseHeaders }
			)
		}

		if (intent === 'delete-account') {
			accountDeletionSchema.parse({
				confirmationText: formData.get('confirmationText')
			})

			const { client, headers: supabaseHeaders } =
				await createSupabaseClient(request)

			// Cancel any active Stripe subscription before the DB cascade removes
			// the subscription record — otherwise Stripe keeps billing the card.
			await cancelStripeSubscriptionsForOrganization(
				userWithDefaults.organization.id
			)

			await deleteUserAndRelatedData(user.id)

			try {
				await client.auth.signOut({ scope: 'local' })
			} catch {
				// Continue to redirect even if session cleanup fails.
			}

			const responseHeaders = new Headers(headers)
			for (const [key, value] of supabaseHeaders.entries()) {
				responseHeaders.append(key, value)
			}

			return redirect('/sign-up', { headers: responseHeaders })
		}

		return data({ error: 'Unknown settings action.' }, { status: 400, headers })
	} catch (error) {
		if (error instanceof ZodError) {
			const fieldErrors: Record<string, string> = {}
			error.errors.forEach((err) => {
				if (err.path.length > 0) {
					fieldErrors[err.path[0] as string] = err.message
				}
			})

			return data(
				{
					error: 'Validation failed',
					intent,
					fieldErrors
				},
				{ status: 400, headers }
			)
		}

		return data(
			{
				error:
					error instanceof Error ? error.message : 'Failed to save settings',
				intent
			},
			{ status: 500, headers }
		)
	}
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

export default function SettingsPage({
	loaderData,
	actionData
}: Route.ComponentProps) {
	const [deleteModalOpen, setDeleteModalOpen] = useState(false)
	const [themeMode, setThemeMode] = useState(loaderData.themeMode)
	const { setPreferencesOpen } = useConsent()

	const handleThemeModeChange = (value: string) => {
		if (value === 'system' || value === 'light' || value === 'dark') {
			setThemeMode(value)
		}
	}
	const csrfToken = useAuthenticityToken()
	const submit = useSubmit()

	const normalizedActionData = (actionData ?? {}) as SettingsActionData
	const actionError = normalizedActionData.error
	const actionSuccess = Boolean(normalizedActionData.success)
	const actionMessage = normalizedActionData.message
	const actionIntent = normalizedActionData.intent
	const actionThemeMode = normalizedActionData.themeMode as
		| ThemeModeValue
		| undefined
	const fieldErrors = normalizedActionData.fieldErrors

	const profileForm = useForm<ProfileFormValues>({
		resolver: zodResolver(profileSettingsSchema),
		mode: 'onChange',
		defaultValues: {
			name: loaderData.userWithDefaults.user.name
		}
	})

	useEffect(() => {
		if (actionIntent !== 'profile' || !fieldErrors) {
			return
		}

		Object.entries(fieldErrors).forEach(([field, message]) => {
			profileForm.setError(field as keyof ProfileFormValues, {
				type: 'server',
				message: String(message)
			})
		})
	}, [actionIntent, fieldErrors, profileForm])

	useEffect(() => {
		if (!actionIntent) {
			return
		}

		if (actionError) {
			toast.error(actionError)
			return
		}

		if (actionSuccess && actionMessage) {
			toast.success(actionMessage)
		}
	}, [actionError, actionIntent, actionMessage, actionSuccess])

	useEffect(() => {
		if (actionIntent === 'preferences' && actionSuccess) {
			if (actionThemeMode) {
				setThemeMode(actionThemeMode)
				applyThemeMode(actionThemeMode)
			}
		}
	}, [actionIntent, actionSuccess, actionThemeMode])

	return (
		<div className="space-y-6 p-6">
			<WrittenConfirmationModal
				open={deleteModalOpen}
				onOpenChange={setDeleteModalOpen}
				title="Delete account"
				description="This permanently deletes your account and all related platform data. Any active paid subscription will be immediately canceled — no further charges will be made. This action cannot be undone."
				confirmationText="DELETE MY ACCOUNT"
				confirmLabel="Delete account"
				onConfirm={(typedText) => {
					submit(
						{
							intent: 'delete-account',
							confirmationText: typedText,
							csrf: csrfToken
						},
						{ method: 'post' }
					)
				}}
			/>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<UserRound className="h-5 w-5" />
						User profile
					</CardTitle>
					<CardDescription>
						Manage your account identity details.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...profileForm}>
						<RemixForm method="post" className="space-y-4">
							<AuthenticityTokenInput />
							<input type="hidden" name="intent" value="profile" />

							<FormField
								control={profileForm.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Display name</FormLabel>
										<FormControl>
											<Input {...field} name="name" placeholder="Jane Doe" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormItem>
								<FormLabel>Email</FormLabel>
								<FormControl>
									<Input
										value={loaderData.userWithDefaults.user.email}
										readOnly
										disabled
									/>
								</FormControl>
							</FormItem>

							<Button type="submit" className="w-full sm:w-auto">
								<Save className="mr-2 h-4 w-4" />
								Save profile
							</Button>
						</RemixForm>
					</Form>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Settings2 className="h-5 w-5" />
						Preferences
					</CardTitle>
					<CardDescription>
						Set your dashboard and visual preferences.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<RemixForm method="post" className="space-y-4">
						<AuthenticityTokenInput />
						<input type="hidden" name="intent" value="preferences" />
						<input type="hidden" name="themeMode" value={themeMode} />

						<div className="space-y-2">
							<label className="text-sm font-medium">Theme</label>
							<Select value={themeMode} onValueChange={handleThemeModeChange}>
								<SelectTrigger>
									<SelectValue placeholder="Select theme" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="system">System</SelectItem>
									<SelectItem value="light">Light</SelectItem>
									<SelectItem value="dark">Dark</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<Button
							type="submit"
							variant="outline"
							className="w-full sm:w-auto"
						>
							Save preferences
						</Button>
					</RemixForm>
				</CardContent>
				<CardFooter className="text-muted-foreground justify-between text-xs">
					<span>Theme is persisted with a secure cookie.</span>
					<Badge variant="secondary">Personal</Badge>
				</CardFooter>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Shield className="h-5 w-5" />
						Privacy &amp; cookies
					</CardTitle>
					<CardDescription>
						Review and update your cookie and tracking preferences.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button
						type="button"
						variant="outline"
						onClick={() => setPreferencesOpen(true)}
					>
						Manage cookie preferences
					</Button>
				</CardContent>
				<CardFooter className="text-muted-foreground justify-between text-xs">
					<span>Changes apply immediately across all sessions.</span>
					<Badge variant="secondary">Personal</Badge>
				</CardFooter>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-destructive flex items-center gap-2">
						<AlertTriangle className="h-5 w-5" />
						Danger zone
					</CardTitle>
					<CardDescription>
						Permanently remove your account and all related data.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Button
						type="button"
						variant="destructive"
						onClick={() => setDeleteModalOpen(true)}
					>
						Delete account
					</Button>
				</CardContent>
			</Card>
		</div>
	)
}
