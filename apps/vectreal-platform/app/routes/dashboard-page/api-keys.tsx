import { Badge } from '@shared/components/ui/badge'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle
} from '@shared/components/ui/empty'
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger
} from '@shared/components/ui/tabs'
import { KeyRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
	data,
	Outlet,
	useFetcher,
	useNavigate,
	useRevalidator
} from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { toast } from 'sonner'

import { Route } from './+types/api-keys'
import {
	OneTimeKeyDialog,
	type OneTimeKeyValue
} from '../../components/api-keys/one-time-key-dialog'
import {
	DataTable,
	createApiKeyColumns,
	type ApiKeyRow
} from '../../components/dashboard'
import { ConfirmDestructiveDialog } from '../../components/shared/confirm-destructive-dialog'
import { FeatureUnavailablePanel } from '../../components/upgrade/feature-unavailable-panel'
import { useDashboardTableState } from '../../hooks/use-dashboard-table-state'
import { useOncePerFetcherResponse } from '../../hooks/use-once-per-fetcher-response'
import {
	getAllUserApiKeys,
	revokeApiKey,
	rotateApiKey,
	type ApiKeyWithDetails
} from '../../lib/domain/auth/api-key-repository.server'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import {
	getOrgSubscription,
	hasEntitlement,
	getRecommendedUpgrade
} from '../../lib/domain/billing/entitlement-service.server'
import { getUserOrganizations } from '../../lib/domain/user/user-repository.server'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'
import { shouldRevalidateWithinScope } from '../../lib/navigation/dashboard-route-behavior'

import type { DashboardConfirmationPlan } from '../../lib/domain/dashboard/dashboard-confirmation'
import type { ShouldRevalidateFunction } from 'react-router'

export async function loader({ request }: Route.LoaderArgs) {
	const { user, headers } = await loadAuthenticatedUser(request)

	const [apiKeys, organizations] = await Promise.all([
		getAllUserApiKeys(user.id),
		getUserOrganizations(user.id)
	])

	const keysByOrg = new Map<string, ApiKeyWithDetails[]>()
	for (const keyData of apiKeys) {
		const orgId = keyData.organization.id
		if (!keysByOrg.has(orgId)) {
			keysByOrg.set(orgId, [])
		}
		keysByOrg.get(orgId)!.push(keyData)
	}

	const adminOrgs = organizations.filter((o) =>
		['admin', 'owner'].includes(o.membership.role)
	)

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
			keysByOrg: Object.fromEntries(keysByOrg),
			organizations: adminOrgs,
			apiKeysAccessByOrg
		},
		{ headers }
	)
}

/**
 * One shape for every outcome of this action.
 *
 * Returning a different object per branch left the client narrowing a union
 * with `in`, which resolved `rotatedKey` to `{}` and lost the one value that
 * cannot be fetched again. A single optional-field contract is also what the
 * component already assumes when it probes with `'success' in fetcher.data`.
 */
interface ApiKeysActionResult {
	success?: true
	message?: string
	error?: string
	/** Present only after a rotation, and only in that one response. */
	rotatedKey?: OneTimeKeyValue
}

export async function action({ request }: Route.ActionArgs) {
	const { user, headers } = await loadAuthenticatedUser(request)
	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) {
		return csrfCheck
	}

	const intent = formData.get('intent') as string

	try {
		const apiKeyId = formData.get('apiKeyId') as string

		if (intent === 'revoke') {
			if (!apiKeyId) {
				return data<ApiKeysActionResult>(
					{ error: 'API key ID is required' },
					{ headers }
				)
			}

			await revokeApiKey(apiKeyId, user.id)
			return data<ApiKeysActionResult>(
				{ success: true, message: 'API key revoked successfully' },
				{ headers }
			)
		}

		if (intent === 'rotate') {
			if (!apiKeyId) {
				return data<ApiKeysActionResult>(
					{ error: 'API key ID is required' },
					{ headers }
				)
			}

			const rotated = await rotateApiKey({ apiKeyId, userId: user.id })

			/*
			  The plaintext leaves the server exactly here and is never persisted in
			  the clear, so the client has one chance to show it. It is deliberately
			  not put in the flash message: toasts disappear on a timer.
			*/
			return data<ApiKeysActionResult>(
				{
					success: true,
					message: 'API key rotated.',
					rotatedKey: {
						plaintext: rotated.plaintext,
						preview: rotated.apiKey.keyPreview,
						name: rotated.apiKey.name
					}
				},
				{ headers }
			)
		}

		return data<ApiKeysActionResult>({ error: 'Invalid intent' }, { headers })
	} catch (error) {
		return data<ApiKeysActionResult>(
			{ error: error instanceof Error ? error.message : 'An error occurred' },
			{ headers }
		)
	}
}

export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	actionResult,
	defaultShouldRevalidate
}) => {
	return shouldRevalidateWithinScope({
		currentPathname: currentUrl.pathname,
		nextPathname: nextUrl.pathname,
		formMethod,
		actionResult,
		defaultShouldRevalidate,
		scopePrefix: '/dashboard/api-keys'
	})
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

function buildApiKeyRows(keys: ApiKeyWithDetails[]): ApiKeyRow[] {
	return keys.map((key) => ({
		id: key.apiKey.id,
		name: key.apiKey.name,
		description: key.apiKey.description,
		keyPreview: key.apiKey.keyPreview,
		createdBy: key.creator.name || key.creator.email || 'Unknown',
		projects: key.projects,
		lastUsedAt: key.apiKey.lastUsedAt,
		active: key.apiKey.active,
		expiresAt: key.apiKey.expiresAt,
		revokedAt: key.apiKey.revokedAt,
		rotatedAt: key.apiKey.rotatedAt
	}))
}

function OrgApiKeysTable({
	namespace,
	rows,
	onEdit,
	onRevoke,
	onRotate
}: {
	namespace: string
	rows: ApiKeyRow[]
	onEdit: (keyId: string) => void
	onRevoke: (keyId: string) => void
	onRotate: (keyId: string) => void
}) {
	const tableState = useDashboardTableState({ namespace })

	const columns = useMemo(
		() =>
			createApiKeyColumns({
				onEdit,
				onRevoke,
				onRotate
			}),
		[onEdit, onRevoke, onRotate]
	)

	if (rows.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<KeyRound />
					</EmptyMedia>
					<EmptyTitle>No API keys</EmptyTitle>
					<EmptyDescription>
						Create your first API key to get started
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	return (
		<DataTable
			columns={columns}
			data={rows}
			searchKey="name"
			searchPlaceholder="Search API keys..."
			searchValue={tableState.searchValue}
			onSearchValueChange={tableState.setSearchValue}
			sorting={tableState.sorting}
			onSortingChange={tableState.onSortingChange}
			pagination={tableState.pagination}
			onPaginationChange={tableState.onPaginationChange}
			rowSelection={tableState.rowSelection}
			onRowSelectionChange={tableState.onRowSelectionChange}
		/>
	)
}

export default function ApiKeysPage({ loaderData }: Route.ComponentProps) {
	const { organizations, keysByOrg, apiKeysAccessByOrg } = loaderData
	const csrfToken = useAuthenticityToken()
	const navigate = useNavigate()
	const fetcher = useFetcher<typeof action>()
	const revalidator = useRevalidator()
	const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
	const [keyToRevokeId, setKeyToRevokeId] = useState<string | null>(null)
	const [rotateDialogOpen, setRotateDialogOpen] = useState(false)
	const [keyToRotateId, setKeyToRotateId] = useState<string | null>(null)
	const [rotatedKey, setRotatedKey] = useState<OneTimeKeyValue | null>(null)
	const isMutating = fetcher.state !== 'idle'

	/**
	 * Whether the in-flight request is the one this dialog would confirm.
	 *
	 * Both dialogs share one fetcher, so a plain `fetcher.state !== 'idle'`
	 * marks a dialog the user just opened for a different key as already
	 * submitting - rendering its confirm button as "Working..." and disabling
	 * Cancel, so it cannot even be dismissed until an unrelated request
	 * finishes.
	 */
	const isSubmittingFor = (keyId: string | null) =>
		isMutating && keyId !== null && fetcher.formData?.get('apiKeyId') === keyId

	const allKeys = useMemo(
		() => Object.values(keysByOrg).flatMap((items) => items),
		[keysByOrg]
	)

	const keysById = useMemo(
		() => new Map(allKeys.map((item) => [item.apiKey.id, item])),
		[allKeys]
	)

	useOncePerFetcherResponse(fetcher, (result) => {
		if ('success' in result && result.success) {
			/*
			  A rotation's plaintext exists only in this response. Capture it into
			  state before the toast, because revalidating replaces `fetcher.data`
			  and the value is unrecoverable once it is gone.
			*/
			if ('rotatedKey' in result && result.rotatedKey) {
				setRotatedKey(result.rotatedKey)
			}

			toast.success(result.message || 'API key revoked successfully')
			revalidator.revalidate()
			return
		}

		if ('error' in result && result.error) {
			toast.error(result.error)
		}
	})

	const handleEdit = (keyId: string) => {
		navigate(`/dashboard/api-keys/${keyId}/edit`)
	}

	const handleRevoke = (keyId: string) => {
		setKeyToRevokeId(keyId)
		setRevokeDialogOpen(true)
	}

	const confirmRevoke = () => {
		if (!keyToRevokeId || isMutating) return

		fetcher.submit(
			{
				intent: 'revoke',
				apiKeyId: keyToRevokeId,
				csrf: csrfToken
			},
			{ method: 'post' }
		)

		setRevokeDialogOpen(false)
		setKeyToRevokeId(null)
	}

	const handleRotate = (keyId: string) => {
		setKeyToRotateId(keyId)
		setRotateDialogOpen(true)
	}

	const confirmRotate = () => {
		if (!keyToRotateId || isMutating) return

		fetcher.submit(
			{
				intent: 'rotate',
				apiKeyId: keyToRotateId,
				csrf: csrfToken
			},
			{ method: 'post' }
		)

		setRotateDialogOpen(false)
		setKeyToRotateId(null)
	}

	if (organizations.length === 0) {
		return (
			<div className="space-y-6 p-6">
				<Empty>
					<EmptyMedia>
						<KeyRound className="text-muted-foreground h-24 w-24" />
					</EmptyMedia>
					<EmptyHeader>No organizations</EmptyHeader>
					<EmptyDescription>
						You need to be an admin or owner of an organization to manage API
						keys.
					</EmptyDescription>
				</Empty>
			</div>
		)
	}

	const defaultOrgId = organizations[0]?.organization.id
	const keyToRevoke = keyToRevokeId ? keysById.get(keyToRevokeId) : null
	const keyToRotate = keyToRotateId ? keysById.get(keyToRotateId) : null

	/*
	  Acknowledge rather than typed, matching revoke: rotating is recoverable by
	  rotating again, and the irreversible part is not the key, it is the minutes
	  the embed is broken until the snippet is updated. That is what the
	  consequences below have to say out loud.
	*/
	const rotatePlan: DashboardConfirmationPlan = {
		tier: 'acknowledge',
		title: keyToRotate
			? `Rotate "${keyToRotate.apiKey.name}"?`
			: 'Rotate API key?',
		description: keyToRotate
			? `Key ending ${keyToRotate.apiKey.keyPreview} is replaced by a new one immediately.`
			: 'The current key is replaced by a new one immediately.',
		consequences: [
			'Every embed still carrying the current key is refused until you paste in the new one',
			'The new key is shown once, right after rotating, and cannot be recovered later',
			'The name, projects and expiry stay as they are'
		],
		confirmLabel: 'Rotate key',
		token: null
	}

	/*
	  Revoking is destructive but recoverable by issuing a new key, so it sits at
	  the acknowledge tier rather than asking the user to type anything. It is
	  built by hand rather than by `planDeleteConfirmation` because an API key is
	  not one of the entity types that endpoint owns.
	*/
	const revokePlan: DashboardConfirmationPlan = {
		tier: 'acknowledge',
		title: keyToRevoke
			? `Revoke "${keyToRevoke.apiKey.name}"?`
			: 'Revoke API key?',
		description: keyToRevoke
			? `Key ending ${keyToRevoke.apiKey.keyPreview} stops working immediately.`
			: 'This key stops working immediately.',
		consequences: [
			'Any application still using this key loses access at once',
			'This cannot be undone - issue a new key to restore access'
		],
		confirmLabel: 'Revoke key',
		token: null
	}

	return (
		<>
			<div className="space-y-6 p-6">
				{organizations.length === 1 ? (
					/*
					  A section heading over the table, matching every other dashboard
					  route. This used to be a `Card` wrapping `DataTable`, which
					  renders its own raised panel - so the table sat on a surface
					  inside a surface.
					*/
					<section className="space-y-4">
						<div>
							<h2 className="text-h4">{organizations[0].organization.name}</h2>
							<p className="text-muted-foreground text-sm">
								{keysByOrg[organizations[0].organization.id]?.length || 0} API{' '}
								{keysByOrg[organizations[0].organization.id]?.length === 1
									? 'key'
									: 'keys'}{' '}
								configured for secure embed and preview access
							</p>
						</div>
						{apiKeysAccessByOrg[organizations[0].organization.id]?.granted ? (
							<OrgApiKeysTable
								namespace={`api-keys-${organizations[0].organization.id}`}
								rows={buildApiKeyRows(
									keysByOrg[organizations[0].organization.id] || []
								)}
								onEdit={handleEdit}
								onRevoke={handleRevoke}
								onRotate={handleRotate}
							/>
						) : (
							<FeatureUnavailablePanel
								title="API key management is temporarily unavailable"
								description="This organization currently cannot manage API keys. Check billing state or organization access and try again."
								plan={
									apiKeysAccessByOrg[organizations[0].organization.id]?.plan
								}
								upgradeTo={
									apiKeysAccessByOrg[organizations[0].organization.id]
										?.upgradeTo ?? null
								}
								actionAttempted="api_keys_view"
							/>
						)}
					</section>
				) : (
					<Tabs defaultValue={defaultOrgId}>
						<TabsList className="mb-4">
							{organizations.map((org) => (
								<TabsTrigger
									key={org.organization.id}
									value={org.organization.id}
								>
									{org.organization.name}
									<Badge variant="secondary" className="ml-2">
										{keysByOrg[org.organization.id]?.length || 0}
									</Badge>
								</TabsTrigger>
							))}
						</TabsList>

						{organizations.map((org) => (
							<TabsContent
								key={org.organization.id}
								value={org.organization.id}
							>
								<section className="space-y-4">
									<p className="text-muted-foreground text-sm">
										API keys for {org.organization.name}
									</p>
									{apiKeysAccessByOrg[org.organization.id]?.granted ? (
										<OrgApiKeysTable
											namespace={`api-keys-${org.organization.id}`}
											rows={buildApiKeyRows(
												keysByOrg[org.organization.id] || []
											)}
											onEdit={handleEdit}
											onRevoke={handleRevoke}
											onRotate={handleRotate}
										/>
									) : (
										<FeatureUnavailablePanel
											title="API key management is temporarily unavailable"
											description="This organization currently cannot manage API keys. Check billing state or organization access and try again."
											plan={apiKeysAccessByOrg[org.organization.id]?.plan}
											upgradeTo={
												apiKeysAccessByOrg[org.organization.id]?.upgradeTo ??
												null
											}
											actionAttempted="api_keys_view"
										/>
									)}
								</section>
							</TabsContent>
						))}
					</Tabs>
				)}

				<ConfirmDestructiveDialog
					open={revokeDialogOpen}
					onOpenChange={setRevokeDialogOpen}
					plan={revokePlan}
					isPending={isSubmittingFor(keyToRevokeId)}
					onConfirm={confirmRevoke}
				/>

				<ConfirmDestructiveDialog
					open={rotateDialogOpen}
					onOpenChange={setRotateDialogOpen}
					plan={rotatePlan}
					isPending={isSubmittingFor(keyToRotateId)}
					onConfirm={confirmRotate}
				/>

				<OneTimeKeyDialog
					open={rotatedKey !== null}
					onClose={() => setRotatedKey(null)}
					apiKey={rotatedKey}
					reason="rotated"
				/>
			</div>

			<Outlet />
		</>
	)
}
