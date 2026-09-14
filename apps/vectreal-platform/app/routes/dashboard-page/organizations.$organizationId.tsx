import { Alert, AlertDescription } from '@shared/components/ui/alert'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
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
import { AlertCircle, Building2, Calendar, Crown, Users } from 'lucide-react'
import { useState } from 'react'
import { data, Form as RemixForm, useSubmit } from 'react-router'
import {
	AuthenticityTokenInput,
	useAuthenticityToken
} from 'remix-utils/csrf/react'
import { z, ZodError } from 'zod'

import { Route } from './+types/organizations.$organizationId'
import {
	DestructiveAction,
	DestructiveActionButton
} from '../../components/layout-components'
import { ConfirmDestructiveDialog } from '../../components/shared/confirm-destructive-dialog'
import { isBillingStateReadOnly } from '../../constants/plan-config'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import {
	getOrgSubscription,
	hasEntitlement
} from '../../lib/domain/billing/entitlement-service.server'
import { QuotaExceededError } from '../../lib/domain/billing/quota-exceeded-error'
import { DASHBOARD_CONFIRMATION_TOKEN } from '../../lib/domain/dashboard/dashboard-confirmation'
import { canPerformDashboardOperation } from '../../lib/domain/dashboard/dashboard-operations'
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

import type { DashboardConfirmationPlan } from '../../lib/domain/dashboard/dashboard-confirmation'

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

/**
 * A destructive organization action waiting on confirmation: the copy to show,
 * and the form fields to post once the user agrees.
 */
interface PendingOrganizationAction {
	plan: DashboardConfirmationPlan
	fields: Record<string, string>
}

const LEAVE_ORGANIZATION_ACTION: PendingOrganizationAction = {
	plan: {
		tier: 'acknowledge',
		title: 'Leave this organization?',
		description: 'You lose access to everything inside it.',
		consequences: [
			'Its projects, scenes and API keys stop appearing in your dashboard',
			'Rejoining requires an invitation from an owner or admin'
		],
		confirmLabel: 'Leave organization',
		token: null
	},
	fields: { intent: 'leave-organization' }
}

function removeMemberAction(
	targetUserId: string,
	displayName: string
): PendingOrganizationAction {
	return {
		plan: {
			tier: 'acknowledge',
			title: `Remove ${displayName}?`,
			description: 'They lose access to this organization immediately.',
			consequences: [
				'Their projects and scenes stay with the organization',
				'You can invite them back at any time'
			],
			confirmLabel: 'Remove member',
			token: null
		},
		fields: { intent: 'remove-member', targetUserId }
	}
}

function deleteOrganizationAction(
	organizationName: string
): PendingOrganizationAction {
	return {
		plan: {
			tier: 'typed',
			title: `Delete organization "${organizationName}"?`,
			description: 'This removes the organization and every membership in it.',
			consequences: [
				'Every member loses access immediately',
				'API keys scoped to this organization stop working',
				'This cannot be undone'
			],
			confirmLabel: 'Delete organization',
			token: DASHBOARD_CONFIRMATION_TOKEN
		},
		fields: { intent: 'delete-organization' }
	}
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

	const { user, headers } = await loadAuthenticatedUser(request)

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
			// The UI hides this behind `canManageMembers`, which folds in the
			// multi-member entitlement - but the action only checked the role, so a
			// direct POST bypassed the plan gate that every sibling intent enforces.
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
		/*
		  A seat refusal is not a server error. `inviteOrganizationMember` began
		  throwing `QuotaExceededError` when `org_seats` moved off the inert
		  `checkQuota` and onto a real row count; before that the throw was
		  unreachable, so this catch had never needed a branch for it. A business
		  organization inviting an eleventh member got a 500 carrying the sentence
		  "Seat limit reached for your plan (10)".

		  403 matches how the `org_multi_member` and `org_roles` refusals in this
		  same action already answer, and the message reaches the same alert.

		  No quota envelope: this page reads `error`, `success`, `message`,
		  `intent` and `fieldErrors` off the action and nothing else, so the extra
		  fields would be returned and dropped. Turning the refusal into the
		  upgrade dialog `api-keys-new.tsx` opens means teaching the component
		  `upgradeModalAtom`, which is a change to the page rather than to what
		  this action answers. Filed.
		*/
		if (error instanceof QuotaExceededError) {
			return data({ error: error.message, intent }, { status: 403, headers })
		}

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
		/*
		  `projectsTotal` stays in the loader and is not read here: the header
		  description is built from it in `use-dashboard-content.ts`, which reads
		  this route's loader data directly. Destructuring it again is what put
		  the same number on the page twice.
		*/
		/*
		  `billing` stays in the loader and is not read here: the plan is part of
		  the header description, built in `use-dashboard-content.ts` from this
		  route's loader data. A read-only billing state has its own alert above.
		*/
		entitlements,
		isReadOnlyBillingState,
		user
	} = loaderData

	const canManageOrg = canPerformDashboardOperation('organization:update', {
		role: membership.role
	})
	const canDeleteOrg = canPerformDashboardOperation('organization:delete', {
		role: membership.role
	})
	const canManageMembers = canManageOrg && entitlements.orgMultiMember
	const canManageRoles = canManageOrg && entitlements.orgRoles

	/*
	  Whether the Actions column can hold anything at all. Role editing needs the
	  entitlement; removal needs someone other than yourself to remove. On a free
	  single-member organization - which is every organization in production -
	  neither is ever true, so the column drew a heading over four empty cells.
	*/
	const hasMemberActions =
		!isReadOnlyBillingState &&
		(canManageRoles ||
			(canManageMembers && members.some((m) => m.user.id !== user.id)))

	/*
	  All three of these used to be bare submit buttons: one click removed a
	  teammate, left the organization, or deleted it outright. They now route
	  through the shared confirmation, with deletion at the typed tier because it
	  is the only one of the three that cannot be undone by re-inviting someone.
	*/
	const submit = useSubmit()
	const csrfToken = useAuthenticityToken()
	const [pendingAction, setPendingAction] =
		useState<PendingOrganizationAction | null>(null)

	const confirmPendingAction = () => {
		if (!pendingAction) {
			return
		}

		submit({ ...pendingAction.fields, csrf: csrfToken }, { method: 'post' })
		setPendingAction(null)
	}
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

			{/*
			  No stat band, and no plan line either. This page opened with four
			  read-only cards - role, plan, members, projects - above the three
			  things anyone comes here to do: rename the organization, manage who
			  is in it, leave or delete it.

			  Each was already stated, or now is. `Current role` is the viewer's
			  own row in the members table below, with the same badge. Members,
			  projects and the plan are the header's description line, which
			  `use-dashboard-content.ts` owns for this page the way it does for a
			  project and a folder. A lone paragraph restating the plan under the
			  title was the same mistake one size smaller.
			*/}

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
						<label htmlFor="organization-name" className="text-sm font-medium">
							Organization name
						</label>
						<Input
							id="organization-name"
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
									{hasMemberActions && (
										<TableHead className="text-right">Actions</TableHead>
									)}
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
											{hasMemberActions && (
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
																		<SelectItem value="member">
																			Member
																		</SelectItem>
																		<SelectItem value="admin">Admin</SelectItem>
																		{membership.role === 'owner' && (
																			<SelectItem value="owner">
																				Owner
																			</SelectItem>
																		)}
																	</SelectContent>
																</Select>
																<Button
																	size="sm"
																	type="submit"
																	variant="outline"
																>
																	Save
																</Button>
															</RemixForm>
														)}

														{canManageMembers &&
															!isReadOnlyBillingState &&
															!isCurrentUser && (
																<Button
																	size="sm"
																	variant="destructive"
																	type="button"
																	onClick={() =>
																		setPendingAction(
																			removeMemberAction(
																				member.user.id,
																				member.user.name ||
																					member.user.email ||
																					'this member'
																			)
																		)
																	}
																>
																	Remove
																</Button>
															)}
													</div>
												</TableCell>
											)}
										</TableRow>
									)
								})}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			{/*
			  Leaving is not destroying. It sat beside deletion in one destructive
			  card, both full-width, so the reversible action - re-invite and you are
			  back - wore the same warning as the one that ends the organization. The
			  confirmation tiers already told them apart: acknowledge against typed.
			*/}
			<Card>
				<CardContent className="space-y-6">
					{/*
					  Both exits read the same way - a sentence, then its control -
					  which is the shape `DestructiveAction` exists to hold and the one
					  `settings.tsx` uses. Leaving was a bare button above all of this,
					  so the card opened with a control that explained nothing and then
					  offered an explanation before its own control.

					  They stay told apart by the control, not by the frame: leaving is
					  an outline button because you can be invited back, deleting is the
					  quiet ghost every destroying surface in the app shares.
					*/}
					<DestructiveAction description="Leaving gives up your own access. An owner or admin can invite you back.">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={isReadOnlyBillingState}
							onClick={() => setPendingAction(LEAVE_ORGANIZATION_ACTION)}
						>
							Leave organization
						</Button>
					</DestructiveAction>

					{/*
					  "and everything scoped to it" contradicted the note directly
					  below it: deletion needs the organization to be empty of
					  projects, so there is no scene or folder left to remove. What it
					  does end is the organization and every membership in it, which
					  is what the confirmation dialog has always said.
					*/}
					<DestructiveAction
						description="Deleting the organization ends it for every member."
						note="Only possible once no projects remain."
					>
						<DestructiveActionButton
							disabled={!canDeleteOrg || isReadOnlyBillingState}
							onClick={() =>
								setPendingAction(deleteOrganizationAction(organization.name))
							}
						>
							Delete organization
						</DestructiveActionButton>
					</DestructiveAction>
				</CardContent>
			</Card>

			{pendingAction ? (
				<ConfirmDestructiveDialog
					open
					onOpenChange={(open) => {
						if (!open) {
							setPendingAction(null)
						}
					}}
					plan={pendingAction.plan}
					onConfirm={confirmPendingAction}
				/>
			) : null}
		</div>
	)
}
