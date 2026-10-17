import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { Button } from '@shared/components/ui/button'
import { Checkbox } from '@shared/components/ui/checkbox'
import { Label } from '@shared/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { CheckIcon } from 'lucide-react'
import { Form, redirect, useNavigation, type MetaFunction } from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'

import { Route } from './+types/oauth-consent-page'
import { AuthErrorBoundary } from '../../components/errors'
import {
	listAgentGrants,
	upsertAgentGrant
} from '../../lib/domain/agent/agent-grant-repository.server'
import {
	AGENT_SCOPE_DESCRIPTIONS,
	AGENT_SCOPES,
	REQUIRED_AGENT_SCOPES,
	type AgentScope
} from '../../lib/domain/agent/agent-scopes'
import {
	chooseConsentOrganization,
	consentDocumentHeaders,
	consentsWithoutValidGrant,
	describeRedirectTarget,
	parseConsentForm
} from '../../lib/domain/agent/oauth-consent'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import { getUserOrganizations } from '../../lib/domain/user/user-repository.server'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'
import { buildMeta } from '../../lib/seo'
import { createSupabaseClient } from '../../lib/supabase.server'

import type { ReactNode } from 'react'

export { AuthErrorBoundary as ErrorBoundary }

export const meta: MetaFunction = () =>
	buildMeta(
		[
			{ title: 'Authorize access - Vectreal' },
			{ property: 'og:title', content: 'Authorize access - Vectreal' }
		],
		undefined,
		{ private: true }
	)

export function headers({ loaderHeaders, actionHeaders }: Route.HeadersArgs) {
	return consentDocumentHeaders({ loaderHeaders, actionHeaders })
}

/*
  Supabase Auth sends the browser here (`[auth.oauth_server]
  authorization_url_path`) with an `authorization_id` after an OAuth client
  starts a sign-in. A visitor without a session is sent through sign-up or
  sign-in by `loadAuthenticatedUser` and returns here through `next`, which is
  how an account gets created from a CLI.

  Responses carry the Headers object `createSupabaseClient` returns, not a
  copy: the client is cached per request, so a session refreshed during any
  OAuth call below appends its cookies there, and a copy taken earlier would
  drop them.
*/

type ConsentView =
	| { kind: 'invalid' }
	| {
			kind: 'consent'
			clientName: string
			redirectTarget: string
			email: string
			organizations: Array<{ id: string; name: string }>
			organizationId: string
			scopes: AgentScope[]
			isRenewal: boolean
	  }

function authorizationIdFrom(request: Request): string | null {
	return (
		new URL(request.url).searchParams.get('authorization_id')?.trim() || null
	)
}

/**
 * Supabase answers an unknown, expired or already-used authorization with a
 * 4xx. Those are a stale link, not a fault, so the page explains them; any
 * other failure is ours and goes to the error boundary.
 */
function isStaleAuthorization(error: { status?: number } | null): boolean {
	return (
		error?.status !== undefined && error.status >= 400 && error.status < 500
	)
}

export async function loader({ request }: Route.LoaderArgs) {
	const { user, userWithDefaults } = await loadAuthenticatedUser(request)
	const { client, headers } = await createSupabaseClient(request)

	const authorizationId = authorizationIdFrom(request)
	if (!authorizationId) {
		return Response.json({ kind: 'invalid' } satisfies ConsentView, {
			headers
		})
	}

	const [memberships, grants, consents] = await Promise.all([
		getUserOrganizations(user.id),
		listAgentGrants(user.id),
		client.auth.oauth.listGrants()
	])
	if (consents.error) throw consents.error
	const memberOrganizationIds = memberships.map(
		({ organization }) => organization.id
	)

	// Before Supabase can auto-approve: a consent it holds for a client whose
	// grant is gone or points at an organization the user left is withdrawn,
	// so the user is asked again instead of being handed a token that cannot
	// act anywhere.
	const stale = consentsWithoutValidGrant({
		consentedClientIds: consents.data.map(({ client }) => client.id),
		grants,
		memberOrganizationIds
	})
	for (const clientId of stale) {
		const { error } = await client.auth.oauth.revokeGrant({ clientId })
		if (error) throw error
	}

	const { data, error } =
		await client.auth.oauth.getAuthorizationDetails(authorizationId)

	if (error || !data) {
		if (isStaleAuthorization(error)) {
			return Response.json({ kind: 'invalid' } satisfies ConsentView, {
				headers
			})
		}
		throw error ?? new Error('Authorization details missing')
	}

	// Consent Supabase still holds is backed by a valid grant (see above), so
	// following its auto-approval is safe.
	if ('redirect_url' in data) {
		throw redirect(data.redirect_url, { headers })
	}

	const existingGrant =
		grants.find(({ oauthClientId }) => oauthClientId === data.client.id) ?? null

	const view: ConsentView = {
		kind: 'consent',
		clientName: data.client.name,
		redirectTarget: describeRedirectTarget(data.redirect_uri),
		email: data.user.email,
		organizations: memberships.map(({ organization }) => ({
			id: organization.id,
			name: organization.name
		})),
		organizationId: chooseConsentOrganization(
			memberOrganizationIds,
			existingGrant?.organizationId ?? null,
			userWithDefaults.organization.id
		),
		scopes: existingGrant?.scopes ?? [...AGENT_SCOPES],
		isRenewal: existingGrant !== null
	}

	return Response.json(view, { headers })
}

export async function action({ request }: Route.ActionArgs) {
	// CSRF first: it needs no session, and once the session is loaded it may
	// have been refreshed, so a refusal would have to carry the new cookies.
	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) return csrfCheck

	const { user } = await loadAuthenticatedUser(request)
	const { client, headers } = await createSupabaseClient(request)

	const authorizationId = authorizationIdFrom(request)
	const parsed = parseConsentForm(formData)
	if (!authorizationId || !parsed.ok) {
		return Response.json(
			{
				error: parsed.ok
					? 'This authorization link is incomplete.'
					: parsed.error
			},
			{ status: 400, headers }
		)
	}

	const { decision } = parsed

	if (decision.intent === 'deny') {
		const { data, error } = await client.auth.oauth.denyAuthorization(
			authorizationId,
			{ skipBrowserRedirect: true }
		)
		if (error || !data) {
			if (isStaleAuthorization(error)) {
				throw redirect(request.url, { headers })
			}
			throw error ?? new Error('Denial returned no redirect')
		}
		throw redirect(data.redirect_url, { headers })
	}

	const memberships = await getUserOrganizations(user.id)
	if (
		!memberships.some(
			({ organization }) => organization.id === decision.organizationId
		)
	) {
		return Response.json(
			{ error: 'Choose one of your organizations.' },
			{ status: 400, headers }
		)
	}

	// The client comes from Supabase, never from the form: the grant must
	// belong to the client this authorization was opened for.
	const details =
		await client.auth.oauth.getAuthorizationDetails(authorizationId)
	if (details.error || !details.data) {
		if (isStaleAuthorization(details.error)) {
			throw redirect(request.url, { headers })
		}
		throw details.error ?? new Error('Authorization details missing')
	}
	if ('redirect_url' in details.data) {
		throw redirect(details.data.redirect_url, { headers })
	}
	const oauthClientId = details.data.client.id

	/*
	  Approve, then record. The other order lets a failed approval (an
	  authorization that expired while the page was open) still rewrite the
	  organization and scopes of sessions this client already holds. This way a
	  failure leaves the previous grant untouched, and a grant write that fails
	  after approval never delivers the code, so no token exists without it.
	*/
	const { data, error } = await client.auth.oauth.approveAuthorization(
		authorizationId,
		{ skipBrowserRedirect: true }
	)
	if (error || !data) {
		if (isStaleAuthorization(error)) {
			throw redirect(request.url, { headers })
		}
		throw error ?? new Error('Approval returned no redirect')
	}

	await upsertAgentGrant({
		userId: user.id,
		organizationId: decision.organizationId,
		oauthClientId,
		scopes: decision.scopes
	})

	throw redirect(data.redirect_url, { headers })
}

const ConsentShell = ({ children }: { children: ReactNode }) => (
	<main className="flex min-h-dvh items-center justify-center px-4 py-16">
		<div className="flex w-full max-w-md flex-col gap-8">
			<VectrealLogoAnimated className="h-8 w-auto self-start" />
			{children}
		</div>
	</main>
)

const InvalidAuthorization = () => (
	<ConsentShell>
		<section className="ds-raised flex flex-col gap-4 rounded-2xl p-6">
			<h1 className="text-h3 font-medium">This sign-in link has expired</h1>
			<p className="text-body-sm text-muted-foreground">
				It was already used, or it is no longer valid. Start the sign-in again
				from the tool that sent you here.
			</p>
		</section>
	</ConsentShell>
)

/*
  A scope the user cannot decline is shown as a fact, not as a disabled
  checkbox: a disabled control leaves the tab order and reads as
  "unavailable", when it means "always included".
*/
const RequiredScope = ({ scope }: { scope: AgentScope }) => {
	const { label, description } = AGENT_SCOPE_DESCRIPTIONS[scope]
	return (
		<div className="flex items-start gap-3">
			<span
				aria-hidden
				className="bg-primary text-primary-foreground mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[6px]"
			>
				<CheckIcon className="size-3.5" />
			</span>
			<div className="flex flex-col gap-1">
				<p className="text-body-sm font-medium">
					{label}{' '}
					<span className="text-muted-foreground font-normal">
						(always included)
					</span>
				</p>
				<p className="text-body-sm text-muted-foreground">{description}</p>
			</div>
		</div>
	)
}

const OptionalScope = ({
	scope,
	defaultChecked
}: {
	scope: AgentScope
	defaultChecked: boolean
}) => {
	const { label, description } = AGENT_SCOPE_DESCRIPTIONS[scope]
	const id = `scope-${scope.replace(':', '-')}`
	return (
		<div className="flex items-start gap-3">
			<Checkbox
				id={id}
				name="scope"
				value={scope}
				defaultChecked={defaultChecked}
				aria-describedby={`${id}-description`}
				className="mt-0.5"
			/>
			<div className="flex flex-col gap-1">
				<Label htmlFor={id}>{label}</Label>
				<p
					id={`${id}-description`}
					className="text-body-sm text-muted-foreground"
				>
					{description}
				</p>
			</div>
		</div>
	)
}

const OAuthConsentPage = ({ loaderData, actionData }: Route.ComponentProps) => {
	const view = loaderData as ConsentView
	const navigation = useNavigation()
	const isSubmitting = navigation.state !== 'idle'
	const formError = (actionData as { error?: string } | undefined)?.error

	if (view.kind === 'invalid') {
		return <InvalidAuthorization />
	}

	const hasChoiceOfOrganization = view.organizations.length > 1
	const organizationName = view.organizations.find(
		({ id }) => id === view.organizationId
	)?.name

	return (
		<ConsentShell>
			<Form
				method="post"
				className="ds-raised flex flex-col gap-8 rounded-2xl p-6"
			>
				<AuthenticityTokenInput />

				<header className="flex flex-col gap-4">
					<h1 className="text-h3 font-medium">
						Allow {view.clientName} to use your Vectreal account
					</h1>
					<p className="text-body-sm text-muted-foreground">
						Signed in as <span className="text-foreground">{view.email}</span>.
						Approving returns you to{' '}
						<span className="text-foreground">{view.redirectTarget}</span>.
					</p>
				</header>

				{/* A label only when there is a control to name; one organization is a fact. */}
				{hasChoiceOfOrganization ? (
					<div className="flex flex-col gap-4">
						<Label htmlFor="organizationId">Organization</Label>
						<Select name="organizationId" defaultValue={view.organizationId}>
							<SelectTrigger id="organizationId">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{view.organizations.map((organization) => (
									<SelectItem key={organization.id} value={organization.id}>
										{organization.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				) : (
					<div className="flex flex-col gap-4">
						<input
							type="hidden"
							name="organizationId"
							value={view.organizationId}
						/>
						<p className="text-body-sm font-medium">Organization</p>
						<p className="text-body-sm">{organizationName}</p>
					</div>
				)}

				<fieldset className="flex flex-col gap-4">
					<legend className="text-body-sm mb-4 font-medium">
						It will be able to
					</legend>
					{AGENT_SCOPES.map((scope) =>
						REQUIRED_AGENT_SCOPES.includes(scope) ? (
							<RequiredScope key={scope} scope={scope} />
						) : (
							<OptionalScope
								key={scope}
								scope={scope}
								defaultChecked={view.scopes.includes(scope)}
							/>
						)
					)}
					<p className="text-body-sm text-muted-foreground">
						It can never delete anything. What it may do is also limited by your
						role in the organization.
					</p>
				</fieldset>

				{formError ? (
					<p role="alert" className="text-body-sm text-destructive">
						{formError}
					</p>
				) : null}

				{/* Source order is visual order at every width, so focus follows it. */}
				<div className="flex flex-col gap-4 sm:flex-row sm:justify-end">
					<Button
						type="submit"
						name="intent"
						value="deny"
						variant="ghost"
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button
						type="submit"
						name="intent"
						value="approve"
						disabled={isSubmitting}
					>
						{view.isRenewal ? 'Allow again' : 'Allow access'}
					</Button>
				</div>
			</Form>
		</ConsentShell>
	)
}

export default OAuthConsentPage
