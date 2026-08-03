import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@shared/components/ui/button'
import {
	Drawer,
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
import { Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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

import { Route } from './+types/projects-edit'
import {
	isListScopedProjectEditPath,
	isProjectEditPath
} from '../../../components/dashboard/utils'
import { ConfirmDestructiveDialog } from '../../../components/shared/confirm-destructive-dialog'
import { useDashboardMutations } from '../../../hooks/use-dashboard-mutations'
import { useRouteDrawer } from '../../../hooks/use-route-drawer'
import { loadAuthenticatedUser } from '../../../lib/domain/auth/auth-loader.server'
import { buildDashboardCapabilities } from '../../../lib/domain/dashboard/dashboard-capabilities'
import {
	planDeleteConfirmation,
	toProjectRef
} from '../../../lib/domain/dashboard/dashboard-confirmation'
import { validateAllowedDomainInput } from '../../../lib/domain/embed/embed-domain-policy'
import {
	getProject,
	updateProject
} from '../../../lib/domain/project/project-repository.server'
import { getUserOrganizations } from '../../../lib/domain/user/user-repository.server'
import { ensureValidCsrfFormData } from '../../../lib/http/csrf.server'

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
		),
	allowedEmbedDomains: z.string().optional()
})

type ProjectEditFormValues = z.infer<typeof projectEditSchema>

export async function loader({ request, params }: Route.LoaderArgs) {
	const { projectId } = params

	if (!projectId) {
		throw new Response('Project ID is required', { status: 400 })
	}

	const { user, headers } = await loadAuthenticatedUser(request)

	const [project, organizations] = await Promise.all([
		getProject(projectId, user.id),
		getUserOrganizations(user.id)
	])

	if (!project) {
		throw new Response('Project not found', { status: 404 })
	}

	const capabilities = buildDashboardCapabilities(organizations)

	return data(
		{
			project,
			organizations,
			canDelete: capabilities[project.organizationId]?.canDeleteProject ?? false
		},
		{ headers }
	)
}

/**
 * Where to send the user after a successful save.
 *
 * The value is client-supplied, so it is matched against the two shapes this
 * drawer actually issues rather than prefix-tested - `/dashboard/projects` is a
 * prefix of `/dashboard/projects.evil.example`, and a prefix test would also let
 * a protocol-relative `//host` through.
 *
 * The query string is preserved but never inspected: the list keeps its view,
 * search, sort and page there, and dropping it returned the user to a default
 * grid instead of the table they were reading.
 */
function resolveReturnTo(raw: FormDataEntryValue | null, projectId: string) {
	const fallback = `/dashboard/projects/${projectId}`
	if (typeof raw !== 'string') {
		return fallback
	}

	// A CR or LF in a Location header is header injection, so refuse outright
	// rather than trying to sanitize it.
	if (/[\u0000-\u001f\u007f]/.test(raw)) {
		return fallback
	}

	const queryIndex = raw.indexOf('?')
	const pathname = queryIndex === -1 ? raw : raw.slice(0, queryIndex)
	const search = queryIndex === -1 ? '' : raw.slice(queryIndex)

	if (pathname !== '/dashboard/projects' && pathname !== fallback) {
		return fallback
	}

	return `${pathname}${search}`
}

export async function action({ request, params }: Route.ActionArgs) {
	const { projectId } = params

	if (!projectId) {
		throw new Response('Project ID is required', { status: 400 })
	}

	const { user, headers } = await loadAuthenticatedUser(request)
	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) {
		return csrfCheck
	}

	const name = formData.get('name') as string
	const slug = formData.get('slug') as string
	const allowedEmbedDomainsRaw =
		(formData.get('allowedEmbedDomains') as string | null) ?? ''

	try {
		const validatedData = projectEditSchema.parse({ name, slug })
		const domainValidation = validateAllowedDomainInput(allowedEmbedDomainsRaw)
		if (!domainValidation.ok) {
			return data(
				{
					error: 'Validation failed',
					fieldErrors: {
						allowedEmbedDomains: domainValidation.message
					}
				},
				{ headers }
			)
		}

		await updateProject(
			projectId,
			{
				name: validatedData.name,
				slug: validatedData.slug,
				allowedEmbedDomains:
					domainValidation.patterns.length > 0
						? domainValidation.patterns.join('\n')
						: null
			},
			user.id
		)

		return redirect(resolveReturnTo(formData.get('returnTo'), projectId), {
			headers
		})
	} catch (error) {
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

		return data(
			{
				error:
					error instanceof Error ? error.message : 'Failed to update project'
			},
			{ headers }
		)
	}
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../../components/errors'

const ProjectsEditPage = ({ actionData, loaderData }: Route.ComponentProps) => {
	const { project, organizations, canDelete } = loaderData
	const csrfToken = useAuthenticityToken()
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

	const deletePlan = useMemo(
		() =>
			planDeleteConfirmation([
				toProjectRef({ id: project.id, name: project.name })
			]),
		[project.id, project.name]
	)

	const deleteMutation = useDashboardMutations({
		onSuccess: () => {
			navigate('/dashboard/projects', { replace: true })
		}
	})

	const location = useLocation()
	const navigate = useNavigate()

	const isOpen = isProjectEditPath(location.pathname, project.id)

	/*
	  Closing returns you to wherever you opened the drawer from. Opened from a
	  card, that is the list; opened from the project header, the project. It used
	  to always navigate to the project, so editing from the list quietly moved
	  you into it.

	  The search string travels with it. The list keeps its view, search, sort and
	  page in URL params, so dropping the query returned you to a default grid
	  rather than the table you were reading.
	*/
	const closeTo = isListScopedProjectEditPath(location.pathname)
		? `/dashboard/projects${location.search}`
		: `/dashboard/projects/${project.id}`

	const drawer = useRouteDrawer({ isOpen, closeTo })

	const form = useForm<ProjectEditFormValues>({
		resolver: zodResolver(projectEditSchema),
		mode: 'onChange',
		reValidateMode: 'onChange',
		defaultValues: {
			name: project.name,
			slug: project.slug,
			allowedEmbedDomains: project.allowedEmbedDomains ?? ''
		}
	})

	useEffect(() => {
		if (actionData && 'fieldErrors' in actionData && actionData.fieldErrors) {
			Object.entries(actionData.fieldErrors).forEach(([field, message]) => {
				form.setError(field as keyof ProjectEditFormValues, {
					type: 'server',
					message: String(message)
				})
			})
		}
	}, [actionData, form])

	const handleNameChange = (value: string) => {
		form.clearErrors('name')
		form.setValue('name', value, { shouldValidate: true })
	}

	const projectOrg = organizations.find(
		({ organization }) => organization.id === project.organizationId
	)

	return (
		<Drawer
			open={drawer.open}
			onOpenChange={drawer.onOpenChange}
			onAnimationEnd={drawer.onAnimationEnd}
			direction="right"
		>
			<DrawerContent className="max-w-lg!">
				<DrawerHeader className="border-b">
					<DrawerTitle>Edit Project</DrawerTitle>
					<DrawerDescription>
						Update the details for {project.name}
					</DrawerDescription>
				</DrawerHeader>

				<div className="overflow-y-auto p-6">
					<Form {...form}>
						<RemixForm method="post" className="space-y-6">
							<input type="hidden" name="csrf" value={csrfToken} />
							<input type="hidden" name="returnTo" value={closeTo} />
							{/* Organization (read-only) */}
							<FormItem>
								<FormLabel>Organization</FormLabel>
								<Select
									disabled
									value={project.organizationId}
									name="organizationId"
								>
									<FormControl>
										<SelectTrigger>
											<SelectValue>
												{projectOrg?.organization.name ??
													project.organizationId}
											</SelectValue>
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										<SelectItem value={project.organizationId}>
											{projectOrg?.organization.name ?? project.organizationId}
										</SelectItem>
									</SelectContent>
								</Select>
								<FormDescription>
									Organization cannot be changed after creation
								</FormDescription>
							</FormItem>

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

							<FormField
								control={form.control}
								name="allowedEmbedDomains"
								render={({ field, fieldState }) => (
									<FormItem>
										<FormLabel>Allowed Embed Domains</FormLabel>
										<FormControl>
											<Textarea
												{...field}
												name="allowedEmbedDomains"
												onChange={(e) => {
													form.clearErrors('allowedEmbedDomains')
													field.onChange(e)
												}}
												placeholder={'example.com\n*.example.com'}
												className="min-h-28 font-mono"
											/>
										</FormControl>
										{fieldState.error ? (
											<FormMessage />
										) : (
											<FormDescription>
												One domain pattern per line. Allowed formats are exact
												hosts (example.com) or leading wildcard subdomains
												(*.example.com).
											</FormDescription>
										)}
									</FormItem>
								)}
							/>

							{/* Action buttons */}
							<DrawerFooter className="px-0 pt-4 pb-0">
								<Button type="button" variant="outline" onClick={drawer.close}>
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
							</DrawerFooter>
						</RemixForm>
					</Form>

					{/*
					  Outside the form on purpose: a nested <button> submits its form,
					  so a delete button inside would save the project on the way to
					  destroying it.
					*/}
					<section className="border-destructive/40 mt-8 space-y-3 rounded-2xl border p-4">
						<h3 className="text-destructive text-h4">Danger zone</h3>
						<p className="text-muted-foreground text-sm">
							Deleting this project removes every scene, folder and published
							embed inside it.
						</p>
						<Button
							type="button"
							variant="destructive"
							disabled={!canDelete}
							onClick={() => setDeleteDialogOpen(true)}
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete project
						</Button>
						{!canDelete ? (
							<p className="text-muted-foreground text-xs">
								Only organization owners can delete a project.
							</p>
						) : null}
					</section>

					<ConfirmDestructiveDialog
						open={deleteDialogOpen}
						onOpenChange={(open) => {
							if (!open && deleteMutation.state !== 'idle') {
								return
							}
							setDeleteDialogOpen(open)
						}}
						plan={deletePlan}
						isPending={deleteMutation.state !== 'idle'}
						errorMessage={deleteMutation.lastError}
						onConfirm={(confirmationText) => {
							deleteMutation.submit({
								verb: 'delete',
								targets: [{ type: 'project', id: project.id }],
								confirmationText
							})
						}}
					/>
				</div>
			</DrawerContent>
		</Drawer>
	)
}

export default ProjectsEditPage
