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
import { Save, X } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import {
	redirect,
	Form as RemixForm,
	useLocation,
	useNavigate
} from 'react-router'
import { z, ZodError } from 'zod'

import { Route } from './+types/projects-edit'
import { loadAuthenticatedUser } from '../../../lib/domain/auth/auth-loader.server'
import {
	getProject,
	updateProject
} from '../../../lib/domain/project/project-repository.server'

const projectEditSchema = z.object({
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
		)
})

type ProjectEditFormValues = z.infer<typeof projectEditSchema>

export async function loader({ request, params }: Route.LoaderArgs) {
	const { projectId } = params

	if (!projectId) {
		throw new Response('Project ID is required', { status: 400 })
	}

	const { user } = await loadAuthenticatedUser(request)

	const project = await getProject(projectId, user.id)

	if (!project) {
		throw new Response('Project not found', { status: 404 })
	}

	return { project }
}

export async function action({ request, params }: Route.ActionArgs) {
	const { projectId } = params

	if (!projectId) {
		throw new Response('Project ID is required', { status: 400 })
	}

	const { user } = await loadAuthenticatedUser(request)
	const formData = await request.formData()

	const name = formData.get('name') as string
	const slug = formData.get('slug') as string

	try {
		const validatedData = projectEditSchema.parse({ name, slug })

		await updateProject(
			projectId,
			{ name: validatedData.name, slug: validatedData.slug },
			user.id
		)

		return redirect(`/dashboard/projects/${projectId}`)
	} catch (error) {
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

		return {
			error: error instanceof Error ? error.message : 'Failed to update project'
		}
	}
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../../components/errors'

const ProjectsEditPage = ({ actionData, loaderData }: Route.ComponentProps) => {
	const { project } = loaderData

	const location = useLocation()
	const navigate = useNavigate()

	const isOpen = location.pathname === `/dashboard/projects/${project.id}/edit`

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			navigate(`/dashboard/projects/${project.id}`)
		}
	}

	const form = useForm<ProjectEditFormValues>({
		resolver: zodResolver(projectEditSchema),
		mode: 'onChange',
		reValidateMode: 'onChange',
		defaultValues: {
			name: project.name,
			slug: project.slug
		}
	})

	useEffect(() => {
		if (actionData?.fieldErrors) {
			Object.entries(actionData.fieldErrors).forEach(([field, message]) => {
				form.setError(field as keyof ProjectEditFormValues, {
					type: 'server',
					message
				})
			})
		}
	}, [actionData, form])

	const handleNameChange = (value: string) => {
		form.clearErrors('name')
		form.setValue('name', value, { shouldValidate: true })
	}

	return (
		<Drawer open={isOpen} onOpenChange={handleOpenChange} direction="right">
			<DrawerContent className="max-w-lg!">
				<DrawerHeader className="border-b">
					<div className="flex items-start justify-between">
						<div>
							<DrawerTitle>Edit Project</DrawerTitle>
							<DrawerDescription>
								Update the details for {project.name}
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
					<Form {...form}>
						<RemixForm method="post" className="space-y-6">
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
												}}
												placeholder="my-project"
												className="font-mono"
											/>
										</FormControl>
										{fieldState.error ? (
											<FormMessage />
										) : (
											<FormDescription>
												Used in URLs and must be unique. Changing this may break
												existing links.
											</FormDescription>
										)}
									</FormItem>
								)}
							/>

							{/* Action buttons */}
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
										form.formState.isSubmitting || !form.formState.isValid
									}
									className="flex items-center"
									variant="default"
									size="default"
								>
									{form.formState.isSubmitting ? (
										<>
											<div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
											Saving...
										</>
									) : (
										<>
											<Save className="mr-2 h-4 w-4" />
											Save Changes
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

export default ProjectsEditPage
