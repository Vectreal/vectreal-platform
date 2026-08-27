import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, AlertDescription } from '@shared/components/ui/alert'
import { Button } from '@shared/components/ui/button'
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from '@shared/components/ui/drawer'
import {
	Form,
	FormControl,
	FormDescription,
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
import { Textarea } from '@shared/components/ui/textarea'
import { useSetAtom } from 'jotai/react'
import { AlertCircle, KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
	data,
	Form as RemixForm,
	useLocation,
	useNavigation
} from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { toast } from 'sonner'
import { z, ZodError } from 'zod'

import { Route } from './+types/api-keys-new'
import { OneTimeKeyDialog } from '../../components/api-keys/one-time-key-dialog'
import {
	ProjectMultiSelect,
	type ProjectOption
} from '../../components/dashboard'
import { FeatureUnavailablePanel } from '../../components/upgrade/feature-unavailable-panel'
import { useRouteDrawer } from '../../hooks/use-route-drawer'
import { createApiKey } from '../../lib/domain/auth/api-key-repository.server'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import {
	getOrgSubscription,
	hasEntitlement,
	getRecommendedUpgrade
} from '../../lib/domain/billing/entitlement-service.server'
import { QuotaExceededError } from '../../lib/domain/billing/quota-exceeded-error'
import { getUserProjects } from '../../lib/domain/project/project-repository.server'
import { getUserOrganizations } from '../../lib/domain/user/user-repository.server'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'
import {
	buildUpgradeModalState,
	upgradeModalAtom
} from '../../lib/stores/upgrade-modal-store'

const apiKeyFormSchema = z.object({
	name: z
		.string()
		.min(1, 'Name is required')
		.min(3, 'Name must be at least 3 characters')
		.max(100, 'Name must be less than 100 characters'),
	description: z
		.string()
		.max(500, 'Description must be less than 500 characters')
		.optional(),
	organizationId: z.string().min(1, 'Organization is required'),
	projectIds: z
		.array(z.string())
		.min(1, 'At least one project must be selected'),
	expiration: z.enum(['30', '60', '90', 'never'])
})

type ApiKeyFormValues = z.infer<typeof apiKeyFormSchema>

export async function loader({ request }: Route.LoaderArgs) {
	const { user, headers } = await loadAuthenticatedUser(request)

	const [organizations, userProjects] = await Promise.all([
		getUserOrganizations(user.id),
		getUserProjects(user.id)
	])

	// Only include orgs where user is admin/owner
	const adminOrgs = organizations.filter((o) =>
		['admin', 'owner'].includes(o.membership.role)
	)

	if (adminOrgs.length === 0) {
		throw new Response('You must be an admin or owner to create API keys', {
			status: 403
		})
	}

	const apiKeyEntitlementEntries = await Promise.all(
		adminOrgs.map(async ({ organization }) => {
			const [entitlement, subscription] = await Promise.all([
				hasEntitlement(organization.id, 'org_api_keys'),
				getOrgSubscription(organization.id)
			])

			return [
				organization.id,
				{
					granted: entitlement.granted,
					plan: subscription.plan,
					upgradeTo: getRecommendedUpgrade(subscription.plan)
				}
			] as const
		})
	)

	const apiKeysAccessByOrg = Object.fromEntries(apiKeyEntitlementEntries)

	return data(
		{
			user,
			organizations: adminOrgs,
			userProjects,
			apiKeysAccessByOrg
		},
		{ headers }
	)
}

export async function action({ request }: Route.ActionArgs) {
	const { user, headers } = await loadAuthenticatedUser(request)
	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) {
		return csrfCheck
	}

	const name = formData.get('name') as string
	const description = (formData.get('description') as string) || undefined
	const organizationId = formData.get('organizationId') as string
	const projectIdsStr = formData.get('projectIds') as string
	const expiration = formData.get('expiration') as string

	try {
		// Parse project IDs
		const projectIds = projectIdsStr ? JSON.parse(projectIdsStr) : []

		// Validate input
		const validatedData = apiKeyFormSchema.parse({
			name,
			description,
			organizationId,
			projectIds,
			expiration
		})

		const entitlementDecision = await hasEntitlement(
			validatedData.organizationId,
			'org_api_keys'
		)

		if (!entitlementDecision.granted) {
			return data(
				{
					error:
						'API keys are not available for this organization right now. Please check organization access or billing state.',
					upgrade: {
						reason: 'feature_not_available' as const,
						message:
							'API keys are not available for this organization right now. Please check organization access or billing state.',
						plan: entitlementDecision.effectivePlan,
						upgradeTo: getRecommendedUpgrade(entitlementDecision.effectivePlan),
						actionAttempted: 'api_key_create'
					}
				},
				{ status: 403, headers }
			)
		}

		// Calculate expiration date
		let expiresAt: Date | null = null
		if (validatedData.expiration !== 'never') {
			const days = parseInt(validatedData.expiration)
			expiresAt = new Date()
			expiresAt.setDate(expiresAt.getDate() + days)
		}

		// Create API key
		const result = await createApiKey({
			userId: user.id,
			organizationId: validatedData.organizationId,
			name: validatedData.name,
			description: validatedData.description,
			projectIds: validatedData.projectIds,
			expiresAt
		})

		// Return the plaintext key so the dialog can show it once
		return data(
			{
				success: true,
				apiKey: {
					plaintext: result.plaintext,
					preview: result.apiKey.keyPreview,
					name: result.apiKey.name
				}
			},
			{ headers }
		)
	} catch (error) {
		if (error instanceof QuotaExceededError) {
			return data(
				{
					error: error.message,
					upgrade: {
						reason: 'quota_exceeded' as const,
						message: error.message,
						limitKey: error.limitKey,
						currentValue: error.currentValue,
						limit: error.limit,
						plan: error.plan,
						upgradeTo: error.upgradeTo,
						actionAttempted: 'api_key_create'
					}
				},
				{ status: 403, headers }
			)
		}

		// Handle Zod validation errors
		if (error instanceof ZodError) {
			const fieldErrors: Record<string, string> = {}
			error.issues.forEach((err) => {
				if (err.path.length > 0) {
					const field = err.path[0] as string
					fieldErrors[field] = err.message
				}
			})

			return data(
				{
					error: 'Validation failed',
					fieldErrors
				},
				{ headers }
			)
		}

		// Return general error for display
		return data(
			{
				error:
					error instanceof Error ? error.message : 'Failed to create API key'
			},
			{ headers }
		)
	}
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

export default function ApiKeysNewPage({
	actionData,
	loaderData
}: Route.ComponentProps) {
	const { organizations, userProjects, apiKeysAccessByOrg } = loaderData
	const setUpgradeModal = useSetAtom(upgradeModalAtom)
	const location = useLocation()

	const navigation = useNavigation()
	const isSubmitting = navigation.state !== 'idle'

	const [showKeyDialog, setShowKeyDialog] = useState(false)
	const [createdKey, setCreatedKey] = useState<{
		plaintext: string
		preview: string
		name: string
	} | null>(null)

	// Control drawer open state based on route
	const isOpen = location.pathname === '/dashboard/api-keys/new'

	const form = useForm<ApiKeyFormValues>({
		resolver: zodResolver(apiKeyFormSchema),
		mode: 'onChange',
		reValidateMode: 'onChange',
		defaultValues: {
			name: '',
			description: '',
			organizationId: organizations[0]?.organization.id || '',
			projectIds: [],
			expiration: '90'
		}
	})

	useEffect(() => {
		if (actionData && 'fieldErrors' in actionData && actionData.fieldErrors) {
			Object.entries(actionData.fieldErrors).forEach(([field, message]) => {
				form.setError(field as keyof ApiKeyFormValues, {
					type: 'server',
					message: String(message)
				})
			})
		}
	}, [actionData, form])

	// Get selected organization's projects
	const selectedOrgId = form.watch('organizationId')
	const selectedOrgAccess = selectedOrgId
		? apiKeysAccessByOrg[selectedOrgId]
		: null
	const hasAnyApiKeyAccess = organizations.some(
		(org) => apiKeysAccessByOrg[org.organization.id]?.granted
	)
	const selectedOrgProjects: ProjectOption[] = userProjects
		.filter((p) => p.organizationId === selectedOrgId)
		.map((p) => ({
			id: p.project.id,
			name: p.project.name,
			slug: p.project.slug
		}))

	const isCreateDisabled =
		isSubmitting || showKeyDialog || !selectedOrgAccess?.granted

	// Reset project selection when organization changes
	useEffect(() => {
		form.setValue('projectIds', [])
	}, [selectedOrgId, form])

	// Handle successful creation
	useEffect(() => {
		if (
			actionData &&
			'success' in actionData &&
			actionData.success &&
			'apiKey' in actionData
		) {
			setCreatedKey(actionData.apiKey)
			setShowKeyDialog(true)
			form.reset()
		} else if (
			actionData &&
			typeof actionData === 'object' &&
			'upgrade' in actionData &&
			actionData.upgrade &&
			typeof actionData.upgrade === 'object'
		) {
			setUpgradeModal(
				buildUpgradeModalState(
					actionData.upgrade as Parameters<typeof buildUpgradeModalState>[0]
				)
			)
			if ('error' in actionData && actionData.error) {
				toast.error(String(actionData.error))
			}
		} else if (actionData && 'error' in actionData && actionData.error) {
			toast.error(actionData.error)
		}
	}, [actionData, form, setUpgradeModal])

	const drawer = useRouteDrawer({ isOpen, closeTo: '/dashboard/api-keys' })

	const handleKeyDialogClose = () => {
		setShowKeyDialog(false)
		setCreatedKey(null)
		drawer.close()
	}

	return (
		<>
			<Drawer
				open={drawer.open}
				onOpenChange={drawer.onOpenChange}
				onAnimationEnd={drawer.onAnimationEnd}
				direction="right"
			>
				<DrawerContent className="max-w-lg!">
					<DrawerHeader className="border-b">
						<DrawerTitle>Create API Key</DrawerTitle>
						<DrawerDescription>
							Create a key for secure embed token access across selected
							projects
						</DrawerDescription>
					</DrawerHeader>

					<div className="space-y-6 overflow-y-auto p-6">
						{!hasAnyApiKeyAccess && organizations[0] && (
							<FeatureUnavailablePanel
								title="API key creation is temporarily unavailable"
								description="This organization currently cannot create API keys. Check billing state or organization access and try again."
								plan={
									apiKeysAccessByOrg[organizations[0].organization.id]?.plan
								}
								upgradeTo={
									apiKeysAccessByOrg[organizations[0].organization.id]
										?.upgradeTo ?? null
								}
								actionAttempted="api_key_create"
							/>
						)}

						{hasAnyApiKeyAccess &&
							selectedOrgId &&
							selectedOrgAccess &&
							!selectedOrgAccess.granted && (
								<FeatureUnavailablePanel
									title="API key creation is unavailable for this organization"
									description="Check billing state or organization access and try again."
									plan={selectedOrgAccess.plan}
									upgradeTo={selectedOrgAccess.upgradeTo}
									actionAttempted="api_key_create"
								/>
							)}

						<Alert>
							<AlertCircle className="size-4" />
							<AlertDescription>
								Create separate keys by environment, scope each key to the
								smallest project set possible, and rotate keys regularly.
							</AlertDescription>
						</Alert>

						<Form {...form}>
							<RemixForm method="post" className="space-y-6">
								<AuthenticityTokenInput />
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name *</FormLabel>
											<FormControl>
												<Input placeholder="Production API Key" {...field} />
											</FormControl>
											<FormDescription>
												A descriptive name to identify this key
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="description"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Description</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Used for production embeds on marketing site"
													{...field}
													rows={3}
												/>
											</FormControl>
											<FormDescription>
												Optional description (max 500 characters)
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="organizationId"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Organization *</FormLabel>
											<Select
												onValueChange={field.onChange}
												name="organizationId"
												defaultValue={field.value}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select organization" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{organizations.map((org) => (
														<SelectItem
															key={org.organization.id}
															value={org.organization.id}
														>
															{org.organization.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FormDescription>
												The organization this key belongs to
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="projectIds"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Projects *</FormLabel>
											<FormControl>
												<ProjectMultiSelect
													projects={selectedOrgProjects}
													value={field.value}
													onChange={field.onChange}
													placeholder="Select projects..."
													emptyText={
														selectedOrgId
															? 'No projects in this organization'
															: 'Select an organization first'
													}
													disabled={
														!selectedOrgId || selectedOrgProjects.length === 0
													}
												/>
											</FormControl>
											{/* Hidden input to submit the array */}
											<input
												type="hidden"
												name="projectIds"
												value={JSON.stringify(field.value)}
											/>
											<FormDescription>
												Select which projects this key can access (minimum 1)
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="expiration"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Expiration *</FormLabel>
											<Select
												onValueChange={field.onChange}
												name="expiration"
												defaultValue={field.value}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select expiration" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													<SelectItem value="30">30 days</SelectItem>
													<SelectItem value="60">60 days</SelectItem>
													<SelectItem value="90">90 days</SelectItem>
													<SelectItem value="never">Never expires</SelectItem>
												</SelectContent>
											</Select>
											<FormDescription>
												When this key should expire
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								{actionData &&
									'error' in actionData &&
									actionData.error &&
									!('fieldErrors' in actionData && actionData.fieldErrors) && (
										<Alert variant="destructive">
											<AlertCircle className="size-4" />
											<AlertDescription>{actionData.error}</AlertDescription>
										</Alert>
									)}

								<DrawerFooter className="px-0 pt-4 pb-0">
									<DrawerClose asChild>
										<Button type="button" variant="outline">
											Cancel
										</Button>
									</DrawerClose>
									<Button type="submit" disabled={isCreateDisabled}>
										{isSubmitting ? (
											<>Creating...</>
										) : (
											<>
												<KeyRound className="mr-2 size-4" />
												Create API Key
											</>
										)}
									</Button>
								</DrawerFooter>
							</RemixForm>
						</Form>
					</div>
				</DrawerContent>
			</Drawer>

			<OneTimeKeyDialog
				open={showKeyDialog}
				onClose={handleKeyDialogClose}
				apiKey={createdKey}
				reason="created"
			/>
		</>
	)
}
