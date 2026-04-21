import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@shared/components/ui/button'
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
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
import { AlertCircle, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
	data,
	redirect,
	Form as RemixForm,
	useLocation,
	useNavigate
} from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { z, ZodError } from 'zod'

import { Route } from './+types/projects-new'
import { loadAuthenticatedSession } from '../../../lib/domain/auth/auth-loader.server'
import {
	getOrgSubscription,
	getQuotaLimit,
	getRecommendedUpgrade
} from '../../../lib/domain/billing/entitlement-service.server'
import { computeProjectCreationCapabilities } from '../../../lib/domain/dashboard/dashboard-stats.server'
import {
	createProject,
	getUserProjects
} from '../../../lib/domain/project/project-repository.server'
import { getUserOrganizations } from '../../../lib/domain/user/user-repository.server'
import { ensureValidCsrfFormData } from '../../../lib/http/csrf.server'
import {
	buildUpgradeModalState,
	upgradeModalAtom
} from '../../../lib/stores/upgrade-modal-store'

const projectFormSchema = z.object({
	name: z
		.string()
		.min(1, 'Project name is required')
		.min(3, 'Project name must be at least 3 characters')
		.max(100, 'Project name must be less than 100 characters'),
	slug: z
		.string()
		.min(1, 'Slug is required')
		.min(3, 'Slug must be at least 3 characters')
		.max(50, 'Slug must be less than 50 characters')
		.regex(
			/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
			'Slug must be lowercase letters, numbers, and hyphens only'
		),
	organizationId: z.string().min(1, 'Organization is required'),
	description: z.string().optional()
})

type ProjectFormValues = z.infer<typeof projectFormSchema>

export async function loader({ request }: Route.LoaderArgs) {
	// Authenticate without creating default resources as a side effect.
	const { user, headers } = await loadAuthenticatedSession(request)

	// Fetch organizations for project creation form
	const [organizations, userProjects] = await Promise.all([
		getUserOrganizations(user.id),
		getUserProjects(user.id)
	])

	const projectsTotalByOrganization = userProjects.reduce<
		Record<string, number>
	>((acc, { organizationId }) => {
		acc[organizationId] = (acc[organizationId] || 0) + 1
		return acc
	}, {})

	const quotaEntries = await Promise.all(
		organizations.map(async ({ organization }) => {
			const [quota, subscription] = await Promise.all([
				getQuotaLimit(organization.id, 'projects_total'),
				getOrgSubscription(organization.id)
			])
			return [
				organization.id,
				{
					projectsLimit: quota.limit,
					plan: subscription.plan,
					upgradeTo: getRecommendedUpgrade(subscription.plan)
				}
			] as const
		})
	)

	const projectQuotaByOrganization = Object.fromEntries(
		quotaEntries.map(([organizationId, quota]) => [
			organizationId,
			{
				projectsTotal: projectsTotalByOrganization[organizationId] || 0,
				projectsLimit: quota.projectsLimit,
				plan: quota.plan,
				upgradeTo: quota.upgradeTo
			}
		])
	)

	// Compute project creation capabilities
	const projectCreationCapabilities = computeProjectCreationCapabilities(
		organizations,
		projectQuotaByOrganization
	)

	const loaderData = {
		user,
		organizations,
		projectCreationCapabilities
	}

	return data(loaderData, { headers })
}

export async function action({ request }: Route.ActionArgs) {
	const { user, headers } = await loadAuthenticatedSession(request)
	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) {
		return csrfCheck
	}

	const name = formData.get('name') as string
	const slug = formData.get('slug') as string
	const organizationId = formData.get('organizationId') as string

	try {
		// Validate input
		const validatedData = projectFormSchema.parse({
			name,
			slug,
			organizationId
		})

		// Create project
		const project = await createProject(
			validatedData.organizationId,
			validatedData.name,
			validatedData.slug,
			user.id
		)

		// Redirect to the new project
		return redirect(`/dashboard/projects/${project.id}`, { headers })
	} catch (error) {
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
					error instanceof Error ? error.message : 'Failed to create project'
			},
			{ headers }
		)
	}
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../../components/errors'

const ProjectsNewPage = ({ actionData, loaderData }: Route.ComponentProps) => {
	const { organizations, projectCreationCapabilities } = loaderData
	const setUpgradeModal = useSetAtom(upgradeModalAtom)
	const csrfToken = useAuthenticityToken()

	const location = useLocation()
	const navigate = useNavigate()
	const [isGeneratingSlug, setIsGeneratingSlug] = useState(false)

	// Control drawer open state based on route
	const isOpen = location.pathname === '/dashboard/projects/new'

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			navigate('/dashboard/projects')
		}
	}

	const form = useForm<ProjectFormValues>({
		resolver: zodResolver(projectFormSchema),
		mode: 'onChange',
		reValidateMode: 'onChange',
		defaultValues: {
			name: '',
			slug: '',
			organizationId:
				organizations.length === 1
					? organizations[0].organization.id
					: organizations[0]?.organization.id || '',
			description: ''
		}
	})

	// Set server-side validation errors
	useEffect(() => {
		if (actionData && 'fieldErrors' in actionData && actionData.fieldErrors) {
			Object.entries(actionData.fieldErrors).forEach(([field, message]) => {
				form.setError(field as keyof ProjectFormValues, {
					type: 'server',
					message: String(message)
				})
			})
		}
	}, [actionData, form])

	// Generate slug from name
	const generateSlug = (name: string) => {
		return name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
	}

	// Auto-generate slug when name changes
	const handleNameChange = (value: string) => {
		form.clearErrors('name')
		form.setValue('name', value, { shouldValidate: true })
		if (!form.getValues('slug') || isGeneratingSlug) {
			const generatedSlug = generateSlug(value)
			form.setValue('slug', generatedSlug, { shouldValidate: true })
			setIsGeneratingSlug(true)
		}
	}

	// Get selected organization ID and check if user can create projects in it
	const selectedOrgId = form.watch('organizationId')
	const canCreateInSelectedOrg =
		selectedOrgId && projectCreationCapabilities[selectedOrgId]?.canCreate
	const selectedOrgQuota = selectedOrgId
		? projectCreationCapabilities[selectedOrgId]
		: null
	const quotaExceededCapabilities = Object.values(
		projectCreationCapabilities
	).filter((capability) => capability.quotaExceeded)
	const hasAnyQuotaExceeded = quotaExceededCapabilities.length > 0

	// Check if user has any organization where they can create projects
	const hasAnyCreatePermission = Object.values(
		projectCreationCapabilities
	).some((cap) => cap.canCreate)
	const hasAnyRolePermission = organizations.some(({ membership }) =>
		['owner', 'admin', 'member'].includes(membership.role)
	)

	const openProjectQuotaUpgradeModal = () => {
		const targetOrgCapability =
			(selectedOrgQuota?.quotaExceeded && selectedOrgQuota) ||
			quotaExceededCapabilities[0]

		if (!targetOrgCapability) {
			return
		}

		setUpgradeModal(
			buildUpgradeModalState({
				reason: 'quota_exceeded',
				message:
					targetOrgCapability.projectsLimit === null
						? 'Project creation is currently unavailable for this organization. Upgrade to continue creating projects.'
						: targetOrgCapability.projectsLimit === 1
							? `Project quota reached (${targetOrgCapability.projectsTotal}/${targetOrgCapability.projectsLimit}). Free includes one project. Delete an existing project or upgrade to continue.`
							: `Project quota reached (${targetOrgCapability.projectsTotal}/${targetOrgCapability.projectsLimit}). Upgrade to create more projects.`,
				limitKey: 'projects_total',
				currentValue: targetOrgCapability.projectsTotal,
				limit: targetOrgCapability.projectsLimit,
				plan: targetOrgCapability.plan ?? undefined,
				upgradeTo: targetOrgCapability.upgradeTo,
				actionAttempted: 'project_create'
			})
		)
	}

	const organizationsById = Object.fromEntries(
		organizations.map(({ organization }) => [organization.id, organization])
	)

	return (
		<Drawer open={isOpen} onOpenChange={handleOpenChange} direction="right">
			<DrawerContent className="max-w-lg!">
				<DrawerHeader className="border-b">
					<div className="flex items-start justify-between">
						<div>
							<DrawerTitle>Create New Project</DrawerTitle>
							<DrawerDescription>
								Add a new project to your organization
							</DrawerDescription>
						</div>
						<DrawerClose asChild>
							<Button variant="ghost" size="icon">
								<X className="h-4 w-4" />
							</Button>
						</DrawerClose>
					</div>
				</DrawerHeader>

				<div className="overflow-y-auto p-6">
					{/* No permission / quota warning */}
					{!hasAnyCreatePermission && (
						<div className="border-warning-border bg-warning-bg mb-6 flex items-start gap-3 rounded-lg border p-4">
							<AlertCircle className="text-warning mt-0.5 h-5 w-5 shrink-0" />
							<div className="space-y-2">
								<p className="text-warning-foreground font-semibold">
									{hasAnyQuotaExceeded && hasAnyRolePermission
										? 'Project quota exceeded'
										: 'No permission to create projects'}
								</p>
								<p className="text-warning-muted-foreground text-sm">
									{hasAnyQuotaExceeded && hasAnyRolePermission
										? 'Every organization you can access has reached its project quota. Upgrade to continue creating projects.'
										: "You don't have permission to create projects in any of your organizations. Contact an organization owner or admin."}
								</p>
								{hasAnyQuotaExceeded && hasAnyRolePermission && (
									<Button type="button" onClick={openProjectQuotaUpgradeModal}>
										Upgrade plan
									</Button>
								)}
							</div>
						</div>
					)}

					{/* Selected org permission warning */}
					{selectedOrgId &&
						!canCreateInSelectedOrg &&
						hasAnyCreatePermission && (
							<div className="border-warning-border bg-warning-bg mb-6 flex items-start gap-3 rounded-lg border p-4">
								<AlertCircle className="text-warning mt-0.5 h-5 w-5 shrink-0" />
								<div className="space-y-2">
									<p className="text-warning-foreground font-semibold">
										{selectedOrgQuota?.quotaExceeded
											? 'Project quota exceeded'
											: 'Insufficient permissions'}
									</p>
									<p className="text-warning-muted-foreground text-sm">
										{selectedOrgQuota?.quotaExceeded
											? selectedOrgQuota.projectsLimit === null
												? 'Project creation is temporarily unavailable for this organization.'
												: selectedOrgQuota.projectsLimit === 1
													? `This organization reached its project quota (${selectedOrgQuota.projectsTotal}/${selectedOrgQuota.projectsLimit}). Free includes one project. Delete an existing project or upgrade to continue.`
													: `This organization reached its project quota (${selectedOrgQuota.projectsTotal}/${selectedOrgQuota.projectsLimit}). Upgrade to create more projects.`
											: "You don't have permission to create projects in this organization. Please select a different organization."}
									</p>
									{selectedOrgQuota?.quotaExceeded && (
										<Button
											type="button"
											onClick={openProjectQuotaUpgradeModal}
										>
											Upgrade plan
										</Button>
									)}
								</div>
							</div>
						)}

					{/* Form */}
					<Form {...form}>
						<RemixForm method="post" className="space-y-6">
							<input type="hidden" name="csrf" value={csrfToken} />
							{/* Organization selection */}
							<FormField
								control={form.control}
								name="organizationId"
								render={({ field, fieldState }) => (
									<FormItem>
										<FormLabel>Organization</FormLabel>
										<Select
											onValueChange={(value) => {
												form.clearErrors('organizationId')
												field.onChange(value)
											}}
											defaultValue={field.value}
											name="organizationId"
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select an organization" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{organizations.length > 0 ? (
													organizations.map(({ organization }) => {
														const capability =
															projectCreationCapabilities[organization.id]
														const label = capability?.quotaExceeded
															? `${organization.name} (quota reached)`
															: organization.name

														return (
															<SelectItem
																key={organization.id}
																value={organization.id}
															>
																{label}
															</SelectItem>
														)
													})
												) : (
													<SelectItem value="__no-creatable-orgs__" disabled>
														No organizations available
													</SelectItem>
												)}
											</SelectContent>
										</Select>
										{fieldState.error ? (
											<FormMessage />
										) : (
											<FormDescription>
												{selectedOrgId && organizationsById[selectedOrgId]
													? `Creating in ${organizationsById[selectedOrgId].name}`
													: 'Choose which organization this project belongs to'}
											</FormDescription>
										)}
									</FormItem>
								)}
							/>

							{/* Project name */}
							<FormField
								control={form.control}
								name="name"
								render={({ field, fieldState }) => (
									<FormItem>
										<FormLabel>Project Name</FormLabel>
										<FormControl>
											<Input
												{...field}
												name="name"
												onChange={(e) => handleNameChange(e.target.value)}
												placeholder="My Project"
											/>
										</FormControl>
										{fieldState.error ? (
											<FormMessage />
										) : (
											<FormDescription>
												A descriptive name for your project
											</FormDescription>
										)}
									</FormItem>
								)}
							/>

							{/* Slug */}
							<FormField
								control={form.control}
								name="slug"
								render={({ field, fieldState }) => (
									<FormItem>
										<FormLabel>URL Slug</FormLabel>
										<FormControl>
											<Input
												{...field}
												name="slug"
												onChange={(e) => {
													form.clearErrors('slug')
													field.onChange(e)
													setIsGeneratingSlug(false)
												}}
												placeholder="my-project"
												className="font-mono"
											/>
										</FormControl>
										{fieldState.error ? (
											<FormMessage />
										) : (
											<FormDescription>
												Used in URLs and must be unique. Auto-generated from
												name.
											</FormDescription>
										)}
									</FormItem>
								)}
							/>

							{/* Description (optional) */}
							<FormField
								control={form.control}
								name="description"
								render={({ field, fieldState }) => (
									<FormItem>
										<FormLabel>
											Description{' '}
											<span className="text-muted-foreground font-normal">
												(Optional)
											</span>
										</FormLabel>
										<FormControl>
											<Textarea
												{...field}
												onChange={(e) => {
													form.clearErrors('description')
													field.onChange(e)
												}}
												placeholder="Describe your project..."
												className="min-h-32"
											/>
										</FormControl>
										{fieldState.error ? (
											<FormMessage />
										) : (
											<FormDescription>
												Help your team understand the project's purpose
											</FormDescription>
										)}
									</FormItem>
								)}
							/>

							{/* Action button */}
							<div className="flex justify-end gap-3 pt-4">
								<Button
									type="button"
									variant="outline"
									onClick={() => handleOpenChange(false)}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={
										!canCreateInSelectedOrg ||
										!hasAnyCreatePermission ||
										form.formState.isSubmitting ||
										!form.formState.isValid
									}
									className="flex items-center"
									variant="default"
									size="default"
								>
									{form.formState.isSubmitting ? (
										<>
											<div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
											Creating...
										</>
									) : (
										<>
											<Plus className="mr-2 h-4 w-4" />
											Create Project
										</>
									)}
								</Button>
							</div>
						</RemixForm>
					</Form>
				</div>
			</DrawerContent>
		</Drawer>
	)
}

export default ProjectsNewPage
