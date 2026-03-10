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
import { Textarea } from '@shared/components/ui/textarea'
import { AlertCircle, Save, X } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import {
	data,
	Form as RemixForm,
	redirect,
	useLocation,
	useNavigate,
	useParams
} from 'react-router'
import { toast } from 'sonner'
import { z, ZodError } from 'zod'

import { Route } from './+types/api-keys-edit'
import { ProjectMultiSelect } from '../../components/dashboard/project-multi-select'
import {
	getApiKeyById,
	updateApiKey
} from '../../lib/domain/auth/api-key-repository.server'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import { getUserProjects } from '../../lib/domain/project/project-repository.server'

import type { ProjectOption } from '../../components/dashboard/project-multi-select'

const apiKeyEditSchema = z.object({
	name: z
		.string()
		.min(1, 'Name is required')
		.min(3, 'Name must be at least 3 characters')
		.max(100, 'Name must be less than 100 characters'),
	description: z
		.string()
		.max(500, 'Description must be less than 500 characters')
		.optional(),
	projectIds: z
		.array(z.string())
		.min(1, 'At least one project must be selected')
})

type ApiKeyEditValues = z.infer<typeof apiKeyEditSchema>

export async function loader({ request, params }: Route.LoaderArgs) {
	const { user, headers } = await loadAuthenticatedUser(request)
	const { keyId } = params

	if (!keyId) {
		throw new Response('API key ID is required', { status: 400 })
	}

	const [apiKeyData, userProjects] = await Promise.all([
		getApiKeyById(keyId, user.id),
		getUserProjects(user.id)
	])

	if (!apiKeyData) {
		throw new Response('API key not found', { status: 404 })
	}

	return data(
		{
			user,
			apiKeyData,
			userProjects
		},
		{ headers }
	)
}

export async function action({ request, params }: Route.ActionArgs) {
	const { user, headers } = await loadAuthenticatedUser(request)
	const { keyId } = params
	const formData = await request.formData()

	if (!keyId) {
		throw new Response('API key ID is required', { status: 400 })
	}

	const name = formData.get('name') as string
	const description = (formData.get('description') as string) || undefined
	const projectIdsStr = formData.get('projectIds') as string

	try {
		// Parse project IDs
		const projectIds = projectIdsStr ? JSON.parse(projectIdsStr) : []

		// Validate input
		const validatedData = apiKeyEditSchema.parse({
			name,
			description,
			projectIds
		})

		// Update API key
		await updateApiKey({
			apiKeyId: keyId,
			userId: user.id,
			name: validatedData.name,
			description: validatedData.description,
			projectIds: validatedData.projectIds
		})

		return redirect('/dashboard/api-keys', { headers })
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
					error instanceof Error ? error.message : 'Failed to update API key'
			},
			{ headers }
		)
	}
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

export default function ApiKeysEditPage({
	actionData,
	loaderData
}: Route.ComponentProps) {
	const { apiKeyData, userProjects } = loaderData
	const location = useLocation()
	const navigate = useNavigate()
	const params = useParams()

	// Control drawer open state based on route
	const isOpen =
		location.pathname === `/dashboard/api-keys/${params.keyId}/edit`

	const form = useForm<ApiKeyEditValues>({
		resolver: zodResolver(apiKeyEditSchema),
		mode: 'onChange',
		reValidateMode: 'onChange',
		defaultValues: {
			name: apiKeyData.apiKey.name,
			description: apiKeyData.apiKey.description || '',
			projectIds: apiKeyData.projects.map((p) => p.id)
		}
	})

	useEffect(() => {
		if (actionData && 'fieldErrors' in actionData && actionData.fieldErrors) {
			Object.entries(actionData.fieldErrors).forEach(([field, message]) => {
				form.setError(field as keyof ApiKeyEditValues, {
					type: 'server',
					message: String(message)
				})
			})
		}
	}, [actionData, form])

	// Get projects for the API key's organization
	const orgProjects: ProjectOption[] = userProjects
		.filter((p) => p.organizationId === apiKeyData.organization.id)
		.map((p) => ({
			id: p.project.id,
			name: p.project.name,
			slug: p.project.slug
		}))

	// Show error toast
	useEffect(() => {
		if (actionData && 'error' in actionData && actionData.error) {
			toast.error(actionData.error)
		}
	}, [actionData])

	const handleClose = () => {
		navigate('/dashboard/api-keys')
	}

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			handleClose()
		}
	}

	return (
		<Drawer open={isOpen} onOpenChange={handleOpenChange} direction="right">
			<DrawerContent className="max-w-lg!">
				<DrawerHeader className="border-b">
					<div className="flex items-start justify-between">
						<div>
							<DrawerTitle>Edit API Key</DrawerTitle>
							<DrawerDescription>
								Update the name, description, or project access for this API key
							</DrawerDescription>
						</div>
						<DrawerClose asChild>
							<Button variant="ghost" size="icon">
								<X className="h-4 w-4" />
							</Button>
						</DrawerClose>
					</div>
					<div className="bg-muted text-muted-foreground mt-2 rounded-md px-3 py-2 text-sm">
						<span className="font-medium">{apiKeyData.apiKey.name}</span>
						<code className="ml-2 font-mono text-xs">
							...{apiKeyData.apiKey.keyPreview}
						</code>
					</div>
				</DrawerHeader>

				<div className="overflow-y-auto p-6">
					<Form {...form}>
						<RemixForm method="post" className="space-y-6">
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
								name="projectIds"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Projects *</FormLabel>
										<FormControl>
											<ProjectMultiSelect
												projects={orgProjects}
												value={field.value}
												onChange={field.onChange}
												placeholder="Select projects..."
												emptyText="No projects in this organization"
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

							<Alert>
								<AlertCircle className="size-4" />
								<AlertDescription>
									<strong>Note:</strong> The API key token, organization, and
									expiration date cannot be changed. To modify these, create a
									new key.
								</AlertDescription>
							</Alert>

							{actionData &&
								'error' in actionData &&
								actionData.error &&
								!('fieldErrors' in actionData && actionData.fieldErrors) && (
									<Alert variant="destructive">
										<AlertCircle className="size-4" />
										<AlertDescription>{actionData.error}</AlertDescription>
									</Alert>
								)}

							<DrawerFooter className="px-0 pt-2">
								<Button
									type="submit"
									disabled={form.formState.isSubmitting}
									className="w-full"
								>
									{form.formState.isSubmitting ? (
										<>Saving...</>
									) : (
										<>
											<Save className="mr-2 size-4" />
											Save Changes
										</>
									)}
								</Button>
								<DrawerClose asChild>
									<Button type="button" variant="outline" className="w-full">
										Cancel
									</Button>
								</DrawerClose>
							</DrawerFooter>
						</RemixForm>
					</Form>
				</div>
			</DrawerContent>
		</Drawer>
	)
}
