import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, AlertDescription } from '@shared/components/ui/alert'
import { Button } from '@shared/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@shared/components/ui/dialog'
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
import { AlertCircle, CheckCircle2, Copy, KeyRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Form as RemixForm, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z, ZodError } from 'zod'

import { Route } from './+types/api-keys-new'
import { ProjectMultiSelect } from '../../components/dashboard/project-multi-select'
import { createApiKey } from '../../lib/domain/auth/api-key-repository.server'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import { getUserProjects } from '../../lib/domain/project/project-repository.server'
import { getUserOrganizations } from '../../lib/domain/user/user-repository.server'

import type { ProjectOption } from '../../components/dashboard/project-multi-select'

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
	const { user } = await loadAuthenticatedUser(request)

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

	return {
		user,
		organizations: adminOrgs,
		userProjects
	}
}

export async function action({ request }: Route.ActionArgs) {
	const { user } = await loadAuthenticatedUser(request)
	const formData = await request.formData()

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

		// Return the plaintext key (only time it will be accessible)
		return {
			success: true,
			apiKey: {
				plaintext: result.plaintext,
				preview: result.apiKey.keyPreview,
				name: result.apiKey.name
			}
		}
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
			error: error instanceof Error ? error.message : 'Failed to create API key'
		}
	}
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

function OneTimeKeyDialog({
	open,
	onClose,
	apiKey
}: {
	open: boolean
	onClose: () => void
	apiKey: { plaintext: string; preview: string; name: string } | null
}) {
	const [copied, setCopied] = useState(false)

	const handleCopy = async () => {
		if (!apiKey) return

		try {
			await navigator.clipboard.writeText(apiKey.plaintext)
			setCopied(true)
			toast.success('API key copied to clipboard')
			setTimeout(() => setCopied(false), 2000)
		} catch (_error) {
			toast.error('Failed to copy to clipboard')
		}
	}

	const handleClose = () => {
		if (!copied) {
			// Warn user if they haven't copied yet
			const confirmed = window.confirm(
				'Have you copied your API key? This is the only time it will be displayed.'
			)
			if (!confirmed) return
		}
		onClose()
	}

	if (!apiKey) return null

	return (
		<Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
			<DialogContent
				className="max-w-2xl"
				onEscapeKeyDown={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<CheckCircle2 className="size-5 text-green-600" />
						API Key Created Successfully
					</DialogTitle>
					<DialogDescription>
						Save this key now. For security reasons, it won't be shown again.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<Alert
						variant="default"
						className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950"
					>
						<AlertCircle className="size-4 text-yellow-600 dark:text-yellow-500" />
						<AlertDescription className="text-yellow-800 dark:text-yellow-200">
							<strong>Important:</strong> Copy this key now. Once you close this
							dialog, the full key will no longer be accessible. You'll only see
							the preview (...{apiKey.preview}).
						</AlertDescription>
					</Alert>

					<div className="space-y-2">
						<label className="text-sm font-medium">API Key</label>
						<div className="flex gap-2">
							<div className="text-muted-foreground bg-muted flex-1 rounded-md border p-3 font-mono text-sm break-all">
								{apiKey.plaintext}
							</div>
							<Button
								type="button"
								variant={copied ? 'default' : 'outline'}
								size="icon"
								className="shrink-0"
								onClick={handleCopy}
							>
								{copied ? (
									<CheckCircle2 className="size-4" />
								) : (
									<Copy className="size-4" />
								)}
							</Button>
						</div>
						<p className="text-muted-foreground text-xs">
							Key preview:{' '}
							<code className="font-mono">...{apiKey.preview}</code>
						</p>
					</div>

					<div className="bg-muted space-y-2 rounded-md p-4">
						<h4 className="text-sm font-medium">Next Steps</h4>
						<ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
							<li>Copy the API key above to a secure location</li>
							<li>Use it in your application's authorization header</li>
							<li>
								Format:{' '}
								<code className="text-xs">Authorization: Bearer vctrl_...</code>
							</li>
						</ul>
					</div>
				</div>

				<DialogFooter>
					<Button onClick={handleClose} className="w-full">
						I've Saved My Key
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default function ApiKeysNewPage({
	actionData,
	loaderData
}: Route.ComponentProps) {
	const { organizations, userProjects } = loaderData
	const location = useLocation()
	const navigate = useNavigate()

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
		if (actionData?.fieldErrors) {
			Object.entries(actionData.fieldErrors).forEach(([field, message]) => {
				form.setError(field as keyof ApiKeyFormValues, {
					type: 'server',
					message
				})
			})
		}
	}, [actionData, form])

	// Get selected organization's projects
	const selectedOrgId = form.watch('organizationId')
	const selectedOrgProjects: ProjectOption[] = userProjects
		.filter((p) => p.organizationId === selectedOrgId)
		.map((p) => ({
			id: p.project.id,
			name: p.project.name,
			slug: p.project.slug
		}))

	// Reset project selection when organization changes
	useEffect(() => {
		form.setValue('projectIds', [])
	}, [selectedOrgId, form])

	// Handle successful creation
	useEffect(() => {
		if (actionData?.success && actionData?.apiKey) {
			setCreatedKey(actionData.apiKey)
			setShowKeyDialog(true)
			form.reset()
		} else if (actionData?.error) {
			toast.error(actionData.error)
		}
	}, [actionData, form])

	const handleClose = () => {
		navigate('/dashboard/api-keys')
	}

	const handleKeyDialogClose = () => {
		setShowKeyDialog(false)
		setCreatedKey(null)
		handleClose()
	}

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			handleClose()
		}
	}

	return (
		<>
			<Drawer open={isOpen} onOpenChange={handleOpenChange} direction="right">
				<DrawerContent className="max-w-lg!">
					<DrawerHeader className="border-b">
						<div className="flex items-start justify-between">
							<div>
								<DrawerTitle>Create API Key</DrawerTitle>
								<DrawerDescription>
									Create a new API key for preview and embed access to your
									projects
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

								{actionData?.error && !actionData?.fieldErrors && (
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
											<>Creating...</>
										) : (
											<>
												<KeyRound className="mr-2 size-4" />
												Create API Key
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

			<OneTimeKeyDialog
				open={showKeyDialog}
				onClose={handleKeyDialogClose}
				apiKey={createdKey}
			/>
		</>
	)
}
