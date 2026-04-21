import { Alert, AlertDescription } from '@shared/components/ui/alert'
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
import { Input } from '@shared/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@shared/components/ui/table'
import {
	AlertCircle,
	Building2,
	Calendar,
	Crown,
	Shield,
	Trash2,
	Users
} from 'lucide-react'
import { data, Form as RemixForm } from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z, ZodError } from 'zod'

import { Route } from './+types/organizations.$organizationId'
import { isBillingStateReadOnly } from '../../constants/plan-config'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import {
	getOrgSubscription,
	hasEntitlement
} from '../../lib/domain/billing/entitlement-service.server'
import {
	deleteOrganization,
	getOrganizationDetailForUser,
	getOrganizationMembers,
	getOrganizationProjectsTotal,
	inviteOrganizationMember,
	leaveOrganization,
	removeOrganizationMember,
	updateOrganizationMemberRole,
	updateOrganizationName
} from '../../lib/domain/organization/organization-repository.server'
import { getUserByEmail } from '../../lib/domain/user/user-repository.server'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'

const updateOrganizationSchema = z.object({
	name: z
		.string()
		.min(2, 'Organization name must be at least 2 characters')
		.max(120, 'Organization name must be less than 120 characters')
})

const inviteMemberSchema = z.object({
	email: z.string().email('Enter a valid email address'),
	role: z.enum(['member', 'admin'])
})

const updateRoleSchema = z.object({
	targetUserId: z.string().uuid('Invalid member id'),
	role: z.enum(['owner', 'admin', 'member'])
})

const removeMemberSchema = z.object({
	targetUserId: z.string().uuid('Invalid member id')
})

function statusVariantFromBillingState(
	billingState: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
	if (billingState === 'active' || billingState === 'trialing') {
		return 'default'
	}
	if (billingState === 'past_due' || billingState === 'unpaid') {
		return 'destructive'
	}
	if (billingState === 'canceled') {
		return 'outline'
	}
	return 'secondary'
}

function membershipVariant(
	role: 'owner' | 'admin' | 'member'
): 'default' | 'secondary' | 'outline' {
	if (role === 'owner') {
		return 'default'
	}
	if (role === 'admin') {
		return 'secondary'
	}
	return 'outline'
}

export async function loader({ request, params }: Route.LoaderArgs) {
	const { organizationId } = params
	if (!organizationId) {
		throw new Response('Organization ID is required', { status: 400 })
	}

	const { user, userWithDefaults, headers } =
		await loadAuthenticatedUser(request)

	let detail
	try {
		detail = await getOrganizationDetailForUser(organizationId, user.id)
	} catch {
		throw new Response('Organization not found', { status: 404 })
	}

	const [members, projectsTotal, subscription, orgMultiMember, orgRoles] =
		await Promise.all([
			getOrganizationMembers(organizationId, user.id),
			getOrganizationProjectsTotal(organizationId, user.id),
			getOrgSubscription(organizationId),
			hasEntitlement(organizationId, 'org_multi_member'),
			hasEntitlement(organizationId, 'org_roles')
		])

	return data(
		{
			user,
			userWithDefaults,
			organization: detail.organization,
			membership: detail.membership,
			members,
			projectsTotal,
			billing: subscription,
			entitlements: {
				orgMultiMember: orgMultiMember.granted,
				orgRoles: orgRoles.granted
			},
			isReadOnlyBillingState: isBillingStateReadOnly(subscription.billingState)
		},
		{ headers }
	)
}

export async function action({ request, params }: Route.ActionArgs) {
	const { organizationId } = params
	if (!organizationId) {
		throw new Response('Organization ID is required', { status: 400 })
	}

	const { user, headers } = await loadAuthenticatedUser(request)
	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) {
		return csrfCheck
	}

	const intent = String(formData.get('intent') ?? '')
	const subscription = await getOrgSubscription(organizationId)
	if (isBillingStateReadOnly(subscription.billingState)) {
		return data(
			{
				error:
					'This organization is currently read-only due to its billing state.',
				intent
			},
			{ status: 403, headers }
		)
	}

	try {
		if (intent === 'update-name') {
			const validated = updateOrganizationSchema.parse({
				name: formData.get('name')
			})
			await updateOrganizationName(organizationId, user.id, validated.name)

			return data(
				{ success: true, intent, message: 'Organization name updated.' },
				{ headers }
			)
		}

		if (intent === 'invite-member') {
			const memberEntitlement = await hasEntitlement(
				organizationId,
				'org_multi_member'
			)
			if (!memberEntitlement.granted) {
				return data(
					{
						error:
							'Team members are not available for this organization on the current plan.',
						intent
					},
					{ status: 403, headers }
				)
			}

			const validated = inviteMemberSchema.parse({
				email: formData.get('email'),
				role: formData.get('role')
			})

			if (validated.role === 'admin') {
				const rolesEntitlement = await hasEntitlement(
					organizationId,
					'org_roles'
				)
				if (!rolesEntitlement.granted) {
					return data(
						{
							error:
								'Admin role assignment requires role-management access on your current plan.',
							intent
						},
						{ status: 403, headers }
					)
				}
			}

			const invitedUser = await getUserByEmail(validated.email)
			if (!invitedUser) {
				return data(
					{
						error:
							'This email does not belong to a registered user yet. Ask them to sign up first.',
						intent
					},
					{ status: 404, headers }
				)
			}

			await inviteOrganizationMember(
				organizationId,
				user.id,
				invitedUser.id,
				validated.role
			)

			return data(
				{ success: true, intent, message: `Invited ${invitedUser.email}.` },
				{ headers }
			)
		}

		if (intent === 'update-role') {
			const rolesEntitlement = await hasEntitlement(organizationId, 'org_roles')
			if (!rolesEntitlement.granted) {
				return data(
					{
						error:
							'Role management is not available for this organization on the current plan.',
						intent
					},
					{ status: 403, headers }
				)
			}

			const validated = updateRoleSchema.parse({
				targetUserId: formData.get('targetUserId'),
				role: formData.get('role')
			})

			await updateOrganizationMemberRole(
				organizationId,
				user.id,
				validated.targetUserId,
				validated.role
			)

			return data(
				{ success: true, intent, message: 'Member role updated.' },
				{ headers }
			)
		}

		if (intent === 'remove-member') {
			const validated = removeMemberSchema.parse({
				targetUserId: formData.get('targetUserId')
			})

			await removeOrganizationMember(
				organizationId,
				user.id,
				validated.targetUserId
			)

			return data(
				{ success: true, intent, message: 'Member removed.' },
				{ headers }
			)
		}

		if (intent === 'leave-organization') {
			await leaveOrganization(organizationId, user.id)
			return data(
				{ success: true, intent, message: 'You left the organization.' },
				{ headers }
			)
		}

		if (intent === 'delete-organization') {
			await deleteOrganization(organizationId, user.id)
			return data(
				{ success: true, intent, message: 'Organization deleted.' },
				{ headers }
			)
		}

		return data({ error: 'Unknown action', intent }, { status: 400, headers })
	} catch (error) {
		if (error instanceof ZodError) {
			const fieldErrors: Record<string, string> = {}
				error.issues.forEach((err) => {
				if (err.path.length > 0) {
					fieldErrors[err.path[0] as string] = err.message
				}
			})

			return data(
				{ error: 'Validation failed', fieldErrors, intent },
				{ status: 400, headers }
			)
		}

		return data(
			{
				error:
					error instanceof Error
						? error.message
						: 'Failed to update organization',
				intent
			},
			{ status: 500, headers }
		)
	}
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

export default function OrganizationDetailPage({
	loaderData,
	actionData
}: Route.ComponentProps) {
	const {
		organization,
		membership,
		members,
		projectsTotal,
		billing,
		entitlements,
		isReadOnlyBillingState,
		user
	} = loaderData

	const canManageOrg =
		membership.role === 'owner' || membership.role === 'admin'
	const canDeleteOrg = membership.role === 'owner'
	const canManageMembers = canManageOrg && entitlements.orgMultiMember
	const canManageRoles = canManageOrg && entitlements.orgRoles
	const actionError =
		actionData && 'error' in actionData ? actionData.error : undefined
	const actionSuccess =
		actionData && 'success' in actionData ? actionData.success : false
	const actionMessage =
		actionData && 'message' in actionData ? actionData.message : undefined
	const actionIntent =
		actionData && 'intent' in actionData ? actionData.intent : undefined
	const fieldErrors =
		actionData && 'fieldErrors' in actionData
			? (actionData.fieldErrors as Record<string, string> | undefined)
			: undefined

	return (
		<div className="space-y-6 p-6">
			{actionError && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>{actionError}</AlertDescription>
				</Alert>
			)}

			{actionSuccess && actionMessage && (
				<Alert>
					<AlertDescription>{actionMessage}</AlertDescription>
				</Alert>
			)}

			{isReadOnlyBillingState && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>
						This organization is in a read-only billing state. Management
						actions are temporarily disabled.
					</AlertDescription>
				</Alert>
			)}

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<Card>
					<CardHeader className="space-y-0 pb-2">
						<CardDescription>Current role</CardDescription>
						<CardTitle className="text-base">
							<Badge variant={membershipVariant(membership.role)}>
								{membership.role}
							</Badge>
						</CardTitle>
					</CardHeader>
				</Card>

				<Card>
					<CardHeader className="space-y-0 pb-2">
						<CardDescription>Plan</CardDescription>
						<CardTitle className="flex items-center gap-2 text-base capitalize">
							<Shield className="h-4 w-4" />
							{billing.plan}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<Badge
							variant={statusVariantFromBillingState(billing.billingState)}
						>
							{billing.billingState}
						</Badge>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="space-y-0 pb-2">
						<CardDescription>Members</CardDescription>
						<CardTitle className="flex items-center gap-2 text-base">
							<Users className="h-4 w-4" />
							{members.length}
						</CardTitle>
					</CardHeader>
				</Card>

				<Card>
					<CardHeader className="space-y-0 pb-2">
						<CardDescription>Projects</CardDescription>
						<CardTitle className="flex items-center gap-2 text-base">
							<Building2 className="h-4 w-4" />
							{projectsTotal}
						</CardTitle>
					</CardHeader>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Building2 className="h-5 w-5" />
						Organization details
					</CardTitle>
					<CardDescription>
						Manage core metadata for this organization.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<RemixForm method="post" className="space-y-4">
						<AuthenticityTokenInput />
						<input type="hidden" name="intent" value="update-name" />
						<label className="text-sm font-medium">Organization name</label>
						<Input
							name="name"
							defaultValue={organization.name}
							disabled={!canManageOrg || isReadOnlyBillingState}
						/>
						{actionIntent === 'update-name' && fieldErrors?.name && (
							<p className="text-destructive text-sm">{fieldErrors.name}</p>
						)}
						<Button
							type="submit"
							disabled={!canManageOrg || isReadOnlyBillingState}
						>
							Save organization name
						</Button>
					</RemixForm>

					<div className="text-muted-foreground flex items-center gap-2 text-sm">
						<Calendar className="h-4 w-4" />
						Created {new Date(organization.createdAt).toLocaleDateString()}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Users className="h-5 w-5" />
						Members
					</CardTitle>
					<CardDescription>
						Invite collaborators and manage access by role.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{canManageMembers && !isReadOnlyBillingState && (
						<RemixForm method="post" className="grid gap-3 md:grid-cols-4">
							<AuthenticityTokenInput />
							<input type="hidden" name="intent" value="invite-member" />
							<Input
								className="md:col-span-2"
								name="email"
								type="email"
								placeholder="member@example.com"
							/>
							<Select name="role" defaultValue="member">
								<SelectTrigger>
									<SelectValue placeholder="Role" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="member">Member</SelectItem>
									{entitlements.orgRoles && (
										<SelectItem value="admin">Admin</SelectItem>
									)}
								</SelectContent>
							</Select>
							<Button type="submit">Invite member</Button>
						</RemixForm>
					)}

					{!entitlements.orgMultiMember && (
						<Alert>
							<AlertDescription>
								Multi-member collaboration is not available on this plan.
							</AlertDescription>
						</Alert>
					)}

					<div className="rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>Role</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{members.map((member) => {
									const isCurrentUser = member.user.id === user.id
									return (
										<TableRow key={member.membership.id}>
											<TableCell className="font-medium">
												<div className="flex items-center gap-2">
													{member.user.name}
													{member.membership.role === 'owner' && (
														<Crown className="h-4 w-4 text-amber-500" />
													)}
												</div>
											</TableCell>
											<TableCell>{member.user.email}</TableCell>
											<TableCell>
												<Badge
													variant={membershipVariant(member.membership.role)}
												>
													{member.membership.role}
												</Badge>
											</TableCell>
											<TableCell>
												<div className="flex justify-end gap-2">
													{canManageRoles && !isReadOnlyBillingState && (
														<RemixForm method="post" className="flex gap-2">
															<AuthenticityTokenInput />
															<input
																type="hidden"
																name="intent"
																value="update-role"
															/>
															<input
																type="hidden"
																name="targetUserId"
																value={member.user.id}
															/>
															<Select
																name="role"
																defaultValue={member.membership.role}
															>
																<SelectTrigger className="h-8 w-28">
																	<SelectValue />
																</SelectTrigger>
																<SelectContent>
																	<SelectItem value="member">Member</SelectItem>
																	<SelectItem value="admin">Admin</SelectItem>
																	{membership.role === 'owner' && (
																		<SelectItem value="owner">Owner</SelectItem>
																	)}
																</SelectContent>
															</Select>
															<Button size="sm" type="submit" variant="outline">
																Save
															</Button>
														</RemixForm>
													)}

													{canManageMembers &&
														!isReadOnlyBillingState &&
														!isCurrentUser && (
															<RemixForm method="post">
																<AuthenticityTokenInput />
																<input
																	type="hidden"
																	name="intent"
																	value="remove-member"
																/>
																<input
																	type="hidden"
																	name="targetUserId"
																	value={member.user.id}
																/>
																<Button
																	size="sm"
																	variant="destructive"
																	type="submit"
																>
																	Remove
																</Button>
															</RemixForm>
														)}
												</div>
											</TableCell>
										</TableRow>
									)
								})}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-destructive">Danger zone</CardTitle>
					<CardDescription>
						Destructive organization actions are protected by your role.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-3 md:grid-cols-2">
					<RemixForm method="post" className="space-y-2">
						<AuthenticityTokenInput />
						<input type="hidden" name="intent" value="leave-organization" />
						<Button
							className="w-full"
							type="submit"
							variant="outline"
							disabled={isReadOnlyBillingState}
						>
							Leave organization
						</Button>
					</RemixForm>

					<RemixForm method="post" className="space-y-2">
						<AuthenticityTokenInput />
						<input type="hidden" name="intent" value="delete-organization" />
						<Button
							className="w-full"
							type="submit"
							variant="destructive"
							disabled={!canDeleteOrg || isReadOnlyBillingState}
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete organization
						</Button>
					</RemixForm>
				</CardContent>
				<CardFooter className="text-muted-foreground text-xs">
					Organization deletion is only available when no projects remain.
				</CardFooter>
			</Card>
		</div>
	)
}
