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
	type ApiKeyRow,
	type ApiKeyRowValue
} from '../../components/dashboard'
import { ConfirmDestructiveDialog } from '../../components/shared/confirm-destructive-dialog'
import { FeatureUnavailablePanel } from '../../components/upgrade/feature-unavailable-panel'
import { useDashboardTableState } from '../../hooks/use-dashboard-table-state'
import { useOncePerFetcherResponse } from '../../hooks/use-once-per-fetcher-response'
import { resolveApiKeyState } from '../../lib/domain/auth/api-key-lifecycle'
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
import { canPerformDashboardOperation } from '../../lib/domain/dashboard/dashboard-operations'
import { getUserOrganizations } from '../../lib/domain/user/user-repository.server'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'
import { shouldRevalidateWithinScope } from '../../lib/navigation/dashboard-route-behavior'
import { decryptEmbedToken } from '../../lib/security/embed-token-cipher.server'

import type { DashboardConfirmationPlan } from '../../lib/domain/dashboard/dashboard-confirmation'
import type { ShouldRevalidateFunction } from 'react-router'

/**
 * Whether this key's value can be put in front of its owner, and if not, why.
 *
 * The embed token is public by construction - `buildEmbedUrl` puts it in an
 * `iframe src` on the customer's own page - so the question this answers is
 * "can it be read back", not "may it be seen". `encrypted_key` exists for
 * exactly this, and `/api/projects/:projectId/api-keys` has been answering the
 * same question for the embed panel since #760.
 *
 * `revoked` is read first, and not as a synonym for a null ciphertext.
 * `revokeApiKey` clears the ciphertext on purpose, so both branches would fire
 * for a revoked row - and `never-stored` tells its owner to rotate, which
 * `rotateApiKey` refuses for anything that is not active. Wrong order is a
 * wrong instruction, not a cosmetic slip.
 *
 * Expired and inactive keys still return their value. This field is not asking
 * whether the key works; the Status column already does that, from the same
 * `resolveApiKeyState`. An expired key's value is still what identifies it in a
 * page that has started 404ing.
 */
function resolveRowValue(
	key: ApiKeyWithDetails,
	canReadValue: boolean,
	now: Date
): ApiKeyRowValue {
	if (!canReadValue) {
		return { readable: false, reason: 'withheld' }
	}

	if (resolveApiKeyState(key.apiKey, now) === 'revoked') {
		return { readable: false, reason: 'revoked' }
	}

	if (key.apiKey.encryptedKey === null) {
		return { readable: false, reason: 'never-stored' }
	}

	/*
	  `decryptEmbedToken` returns null for a ciphertext that no longer
	  authenticates as well as for one that was never there, and this is the only
	  place the two are still separable - the branch above has already taken the
	  second case. Past this point they would be one indistinguishable null.
	*/
	const value = decryptEmbedToken(key.apiKey.encryptedKey)

	return value === null
		? { readable: false, reason: 'undecryptable' }
		: { readable: true, value }
}

/**
 * One stored key, reduced to what this page renders.
 *
 * An explicit field list rather than a spread, so a column added to `api_keys`
 * has to be named here before it reaches the browser. `hashedKey` is why: it
 * was in the table from the first migration, a week before this page was
 * written, and went to the browser on every render from the day it shipped.
 * Nothing catches that without a list someone maintains.
 *
 * What the list now sends deliberately includes the key itself, decrypted, and
 * still never `hashedKey` or the `encryptedKey` ciphertext. The plaintext is
 * the value the owner needs; the hash is the only thing an embed request is
 * matched against and has no reader here at all.
 *
 * `api-keys.spec.ts` pins both halves, because a list is only a guarantee while
 * someone maintains it.
 */
function toApiKeyRow(key: ApiKeyWithDetails, value: ApiKeyRowValue): ApiKeyRow {
	return {
		id: key.apiKey.id,
		name: key.apiKey.name,
		description: key.apiKey.description,
		keyPreview: key.apiKey.keyPreview,
		value,
		createdBy: key.creator.name || key.creator.email || 'Unknown',
		projects: key.projects,
		lastUsedAt: key.apiKey.lastUsedAt,
		active: key.apiKey.active,
		expiresAt: key.apiKey.expiresAt,
		revokedAt: key.apiKey.revokedAt,
		rotatedAt: key.apiKey.rotatedAt
	}
}

export async function loader({ request }: Route.LoaderArgs) {
	const { user, headers } = await loadAuthenticatedUser(request)

	const [apiKeys, organizations] = await Promise.all([
		getAllUserApiKeys(user.id),
		getUserOrganizations(user.id)
	])

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

	/*
	  The organizations this page actually draws a table for.

	  `getAllUserApiKeys` returns every key in every org the actor administers,
	  but the component only ever reads `keysByOrg[org.organization.id]` for the
	  orgs in `organizations`. A row outside that set was rendered nowhere and
	  cost a preview; now it would cost a live key in the payload of a page that
	  never draws it.
	*/
	const renderedOrgIds = new Set(adminOrgs.map((o) => o.organization.id))

	/*
	  Where the value may be resolved, decided per organization.

	  `canPerformDashboardOperation` and not `assertDashboardPermission`: this
	  page renders one tab per organization, so throwing would 500 all of them
	  over one. As a filter the check is load-bearing and can be mutation-tested;
	  as an assert it would be unreachable and prove nothing.

	  It is also not redundant with the `adminOrgs` filter above, which only
	  chooses tabs. The restriction that actually runs today is a hardcoded
	  `inArray(role, ['admin', 'owner'])` inside `getAllUserApiKeys` - a second
	  copy of this rule written in SQL that never consults the table. Before this
	  line, tightening `api-key:read` changed nothing on this page.

	  The entitlement term is the same argument as the embed route's project
	  filter: an organization without `org_api_keys` renders
	  `FeatureUnavailablePanel` instead of a table, so decrypting its keys spends
	  AES on markup that does not exist and puts plaintext in memory for nobody.
	*/
	const valueReadableOrgIds = new Set(
		adminOrgs
			.filter((o) =>
				canPerformDashboardOperation('api-key:read', {
					role: o.membership.role
				})
			)
			.filter((o) => apiKeysAccessByOrg[o.organization.id]?.granted)
			.map((o) => o.organization.id)
	)

	const now = new Date()
	const keysByOrg = new Map<string, ApiKeyRow[]>()
	for (const keyData of apiKeys) {
		const orgId = keyData.organization.id
		if (!renderedOrgIds.has(orgId)) continue

		if (!keysByOrg.has(orgId)) {
			keysByOrg.set(orgId, [])
		}
		keysByOrg
			.get(orgId)!
			.push(
				toApiKeyRow(
					keyData,
					resolveRowValue(keyData, valueReadableOrgIds.has(orgId), now)
				)
			)
	}

	/*
	  No `Cache-Control` here, and deliberately, because the omission reads as an
	  oversight beside `/api/projects/:projectId/api-keys`, which sets one by
	  hand.

	  That route is a resource route, which `handleDataRequest` never sees. This
	  one is not: `applyDefaultCacheHeaders` stamps `no-store` on the document and
	  `handleDataRequest` stamps it on the `.data` response, both through the same
	  predicate, and `/dashboard` is a protected prefix so neither can take the
	  cacheable branch. Setting it in this loader would not even reach the `.data`
	  response - React Router does not propagate a loader's `headers` onto one,
	  which is the whole reason that hook exists.
	*/
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
 * with `in`, which resolved `rotatedKey` to `{}` and dropped the freshly minted
 * key before it could be shown. A single optional-field contract is also what
 * the component already assumes when it probes with `'success' in fetcher.data`.
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
			  Carried as its own field rather than in the flash message, because a
			  toast disappears on a timer and this is the one screen that shows the
			  key in full. It is on the row too, encrypted, but nothing here reads
			  it back - that would be a round trip to re-fetch what this response
			  already holds.
			*/
			return data<ApiKeysActionResult>(
				{
					success: true,
					message: 'API key rotated.',
					rotatedKey: {
						plaintext: rotated.plaintext,
						name: rotated.apiKey.name,
						/*
						  Read off what was actually written, not assumed. The cipher
						  returns null rather than throwing when
						  `EMBED_TOKEN_ENCRYPTION_KEY` is unset, so a rotation can
						  succeed and still leave nothing to read back - and the dialog
						  has to say so instead of promising this list will show it.
						*/
						recoverable: rotated.apiKey.encryptedKey !== null
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
			searchPlaceholder="Search by name or last 4 characters..."
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
		() => new Map(allKeys.map((item) => [item.id, item])),
		[allKeys]
	)

	useOncePerFetcherResponse(fetcher, (result) => {
		if ('success' in result && result.success) {
			/*
			  Captured into state because `fetcher.data` is the wrong owner of it.

			  Not, as this comment twice claimed, because revalidation clears it:
			  it does not. A fetcher that submitted is removed from
			  `fetchLoadMatches` before its action runs, so it is never in the
			  revalidation set, and `use-once-per-fetcher-response.ts` opens by
			  saying the same thing - a settled fetcher's `data` outlives the
			  render that produced it.

			  That persistence is the actual problem: rendering the dialog straight
			  off the response leaves `onClose` with nothing to set, so it would
			  reopen on every render for as long as the fetcher holds its answer.
			  Owning it as state is what makes closing it possible at all.

			  This used to add "and the dialog deliberately swallows Escape", which
			  is no longer true - that handler existed to stop Escape bypassing a
			  copy confirmation this change removes, and `one-time-key-dialog.spec`
			  now asserts Escape closes. The conclusion is unchanged; only that
			  reason for it is gone.
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
		title: keyToRotate ? `Rotate "${keyToRotate.name}"?` : 'Rotate API key?',
		description: keyToRotate
			? `Key ending ${keyToRotate.keyPreview} is replaced by a new one immediately.`
			: 'The current key is replaced by a new one immediately.',
		consequences: [
			'Every embed still carrying the current key is refused until you paste in the new one',
			'The new key is shown right after rotating, and appears in this list as soon as the rotation completes',
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
		title: keyToRevoke ? `Revoke "${keyToRevoke.name}"?` : 'Revoke API key?',
		description: keyToRevoke
			? `Key ending ${keyToRevoke.keyPreview} stops working immediately.`
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
								rows={keysByOrg[organizations[0].organization.id] || []}
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
											rows={keysByOrg[org.organization.id] || []}
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
