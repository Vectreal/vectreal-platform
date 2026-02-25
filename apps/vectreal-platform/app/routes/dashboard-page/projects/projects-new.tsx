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
import { AlertCircle, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
	redirect,
	Form as RemixForm,
	useLocation,
	useNavigate
} from 'react-router'
import { z, ZodError } from 'zod'

import { Route } from './+types/projects-new'
import { loadAuthenticatedUser } from '../../../lib/domain/auth/auth-loader.server'
import { computeProjectCreationCapabilities } from '../../../lib/domain/dashboard/dashboard-stats.server'
import { createProject } from '../../../lib/domain/project/project-repository.server'
import { getUserOrganizations } from '../../../lib/domain/user/user-repository.server'

import type { ProjectNewLoaderData } from '../../../lib/domain/dashboard/dashboard-types'

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
	// Authenticate and initialize user
	const { user, userWithDefaults } = await loadAuthenticatedUser(request)

	// Fetch organizations for project creation form
	const organizations = await getUserOrganizations(user.id)

	// Compute project creation capabilities
	const projectCreationCapabilities =
		computeProjectCreationCapabilities(organizations)

	const loaderData: ProjectNewLoaderData = {
		user,
		userWithDefaults,
		organizations,
		projectCreationCapabilities
	}

	return loaderData
}

export async function action({ request }: Route.ActionArgs) {
	const { user } = await loadAuthenticatedUser(request)
	const formData = await request.formData()

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
		return redirect(`/dashboard/projects/${project.id}`)
	} catch (error) {
		// Handle Zod validation errors
		if (error instanceof ZodError) {
			const fieldErrors: Record<string, string> = {}
			error.errors.forEach((err) => {
				if (err.path.length > 0) {
					const field = err.path[0] as string
					fieldErrors[field] = err.message
				}
			})

			return {
				error: 'Validation failed',
				fieldErrors
			}
		}

		// Return general error for display
		return {
			error: error instanceof Error ? error.message : 'Failed to create project'
		}
	}
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../../components/errors'

const ProjectsNewPage = ({ actionData, loaderData }: Route.ComponentProps) => {
	const { organizations, projectCreationCapabilities } = loaderData

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
				organizations.length === 1 ? organizations[0].organization.id : '',
			description: ''
		}
	})

	// Set server-side validation errors
	useEffect(() => {
		if (actionData?.fieldErrors) {
			Object.entries(actionData.fieldErrors).forEach(([field, message]) => {
				form.setError(field as keyof ProjectFormValues, {
					type: 'server',
					message
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

	// Check if user has any organization where they can create projects
	const hasAnyCreatePermission = Object.values(
		projectCreationCapabilities
	).some((cap) => cap.canCreate)

	// Filter organizations to only show those where user can create projects
	const creatableOrganizations = organizations.filter(
		({ organization }) =>
			projectCreationCapabilities[organization.id]?.canCreate
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
					{/* No permission warning */}
					{!hasAnyCreatePermission && (
						<div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
							<AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
							<div className="space-y-1">
								<p className="font-semibold text-amber-900 dark:text-amber-100">
									No permission to create projects
								</p>
								<p className="text-sm text-amber-700 dark:text-amber-300">
									You don't have permission to create projects in any of your
									organizations. Contact an organization owner or admin.
								</p>
							</div>
						</div>
					)}

					{/* Selected org permission warning */}
					{selectedOrgId &&
						!canCreateInSelectedOrg &&
						hasAnyCreatePermission && (
							<div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
								<AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
								<div className="space-y-1">
									<p className="font-semibold text-amber-900 dark:text-amber-100">
										Insufficient permissions
									</p>
									<p className="text-sm text-amber-700 dark:text-amber-300">
										You don't have permission to create projects in this
										organization. Please select a different organization.
									</p>
								</div>
							</div>
						)}

					{/* Form */}
					<Form {...form}>
						<RemixForm method="post" className="space-y-6">
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
												{creatableOrganizations.length > 0 ? (
													creatableOrganizations.map(({ organization }) => (
														<SelectItem
															key={organization.id}
															value={organization.id}
														>
															{organization.name}
														</SelectItem>
													))
												) : (
													<SelectItem value="" disabled>
														No organizations with create permission
													</SelectItem>
												)}
											</SelectContent>
										</Select>
										{fieldState.error ? (
											<FormMessage />
										) : (
											<FormDescription>
												Choose which organization this project belongs to
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
