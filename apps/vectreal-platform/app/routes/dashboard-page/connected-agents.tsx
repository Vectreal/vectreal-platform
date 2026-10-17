import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia
} from '@shared/components/ui/empty'
import { Bot } from 'lucide-react'
import { useState } from 'react'
import { data, useFetcher, useRevalidator } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { toast } from 'sonner'

import { Route } from './+types/connected-agents'
import { DetailPanelSection } from '../../components/layout-components'
import { ConfirmDestructiveDialog } from '../../components/shared/confirm-destructive-dialog'
import { useOncePerFetcherResponse } from '../../hooks/use-once-per-fetcher-response'
import {
	deleteAgentGrant,
	listAgentGrants
} from '../../lib/domain/agent/agent-grant-repository.server'
import { AGENT_SCOPE_DESCRIPTIONS } from '../../lib/domain/agent/agent-scopes'
import {
	listConnectedAgents,
	type ConnectedAgent
} from '../../lib/domain/agent/connected-agents'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import { getUserOrganizations } from '../../lib/domain/user/user-repository.server'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'
import { reportServerError } from '../../lib/observability/report-server-error.server'
import { createSupabaseClient } from '../../lib/supabase.server'

import type { DashboardConfirmationPlan } from '../../lib/domain/dashboard/dashboard-confirmation'

/*
  Every agent the signed-in user approved on `/oauth/consent`, and the one
  place to take an approval back. Grants belong to the user, not to an
  organization, so there is no role to check: the user is read from the
  session, never from the form, and a revoke can only reach their own.

  Responses carry the Headers object `createSupabaseClient` returns, as on the
  consent page: a session refreshed during an OAuth call appends its cookies
  there.
*/

type RevokeResult = { success: true; message: string } | { error: string }

/** What Supabase answers on a stack whose OAuth server is off. */
function isOAuthServerOff(error: { code?: string } | null): boolean {
	return error?.code === 'feature_disabled'
}

export async function loader({ request }: Route.LoaderArgs) {
	const { user } = await loadAuthenticatedUser(request)
	const { client, headers } = await createSupabaseClient(request)

	const [memberships, grants, consents] = await Promise.all([
		getUserOrganizations(user.id),
		listAgentGrants(user.id),
		client.auth.oauth.listGrants()
	])
	if (consents.error && !isOAuthServerOff(consents.error)) {
		// Thrown as a response so a session refreshed above keeps its cookies.
		reportServerError(consents.error, {
			request,
			properties: { userId: user.id }
		})
		throw data('Could not load connected agents.', { status: 502, headers })
	}

	const agents = listConnectedAgents({
		consents: consents.data ?? [],
		grants,
		memberOrganizationIds: memberships.map(
			({ organization }) => organization.id
		)
	})

	return data({ agents }, { headers })
}

export async function action({ request }: Route.ActionArgs) {
	// CSRF first: it needs no session, and once the session is loaded it may
	// have been refreshed, so a refusal would have to carry the new cookies.
	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) return csrfCheck

	const { user } = await loadAuthenticatedUser(request)
	const { client, headers } = await createSupabaseClient(request)

	const clientId = formData.get('clientId')
	if (formData.get('intent') !== 'revoke' || typeof clientId !== 'string') {
		return data<RevokeResult>(
			{ error: 'Choose an agent to revoke.' },
			{ status: 400, headers }
		)
	}

	/*
	  Supabase first: it owns whether the agent's sessions are valid, and
	  revoking deletes them, so refresh fails and the agent API refuses the
	  access token on its next call. Our row goes second. If deleting it fails,
	  the agent is already locked out and the row shows as inactive until a
	  second revoke clears it, which is why a 404 here (no consent left to
	  revoke, or the OAuth server off) still deletes the row.
	*/
	const { error } = await client.auth.oauth.revokeGrant({ clientId })
	if (error && error.status !== 404) {
		return data<RevokeResult>(
			{ error: 'Could not revoke this agent. Try again.' },
			{ status: 502, headers }
		)
	}

	try {
		await deleteAgentGrant(user.id, clientId)
	} catch (deleteError) {
		reportServerError(deleteError, {
			request,
			properties: { userId: user.id, clientId }
		})
		return data<RevokeResult>(
			{
				error:
					'The agent is signed out, but its entry could not be removed. Try again.'
			},
			{ status: 500, headers }
		)
	}

	return data<RevokeResult>(
		{ success: true, message: 'Agent revoked.' },
		{ headers }
	)
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

// A fixed zone, so the server's render and the browser's hydration agree.
const approvedDate = new Intl.DateTimeFormat('en-US', {
	dateStyle: 'medium',
	timeZone: 'UTC'
})

function agentName(agent: ConnectedAgent): string {
	return agent.clientName ?? 'Unknown agent'
}

function ConnectedAgentSection({
	agent,
	onRevoke
}: {
	agent: ConnectedAgent
	onRevoke: (agent: ConnectedAgent) => void
}) {
	const approved = approvedDate.format(new Date(agent.approvedAt))
	const where = agent.organizationName
		? `Acts in ${agent.organizationName}`
		: 'No organization'

	return (
		<DetailPanelSection
			surface="raised"
			headingLevel="h2"
			title={
				<span className="flex items-center gap-2">
					{agentName(agent)}
					{agent.status === 'inactive' && (
						<Badge variant="outline">Inactive</Badge>
					)}
				</span>
			}
			description={`${where} · approved ${approved}`}
			action={
				<Button
					variant="outline"
					size="sm"
					aria-label={`Revoke ${agentName(agent)}, approved ${approved}`}
					onClick={() => onRevoke(agent)}
				>
					Revoke
				</Button>
			}
		>
			{agent.scopes.length > 0 ? (
				<ul className="flex flex-wrap gap-2">
					{agent.scopes.map((scope) => (
						<li key={scope}>
							<Badge variant="secondary">
								{AGENT_SCOPE_DESCRIPTIONS[scope].label}
							</Badge>
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground text-sm">
					No permissions recorded. Signing in again asks for them.
				</p>
			)}
		</DetailPanelSection>
	)
}

export default function ConnectedAgentsPage({
	loaderData
}: Route.ComponentProps) {
	const { agents } = loaderData
	const csrfToken = useAuthenticityToken()
	const fetcher = useFetcher<typeof action>()
	const revalidator = useRevalidator()
	const [toRevoke, setToRevoke] = useState<ConnectedAgent | null>(null)

	useOncePerFetcherResponse(fetcher, (result) => {
		// The dialog stays open, showing progress, until the answer arrives.
		setToRevoke(null)
		if ('success' in result && result.success) {
			toast.success(result.message)
			revalidator.revalidate()
			return
		}
		if ('error' in result && result.error) {
			toast.error(result.error)
		}
	})

	const pendingClientId =
		fetcher.state !== 'idle' ? fetcher.formData?.get('clientId') : null

	const confirmRevoke = () => {
		if (!toRevoke || fetcher.state !== 'idle') return
		fetcher.submit(
			{ intent: 'revoke', clientId: toRevoke.clientId, csrf: csrfToken },
			{ method: 'post' }
		)
	}

	/*
	  Acknowledge rather than typed, matching API key revoke: signing in again
	  restores access, so nothing here is lost for good.
	*/
	const revokePlan: DashboardConfirmationPlan = {
		tier: 'acknowledge',
		title: toRevoke ? `Revoke ${agentName(toRevoke)}?` : 'Revoke agent?',
		description: 'It is signed out at once, wherever it is running.',
		consequences: [
			'Its next request to Vectreal is refused',
			'To use it again, sign in from the agent and approve it again'
		],
		confirmLabel: 'Revoke',
		token: null
	}

	if (agents.length === 0) {
		return (
			<div className="space-y-8 py-6">
				<Empty>
					<EmptyMedia>
						<Bot className="text-muted-foreground h-24 w-24" />
					</EmptyMedia>
					<EmptyHeader>No connected agents</EmptyHeader>
					<EmptyDescription>
						When you sign in to Vectreal from a CLI or an AI agent and approve
						it, it shows up here, and you can revoke it at any time.
					</EmptyDescription>
				</Empty>
			</div>
		)
	}

	return (
		<div className="space-y-4 py-6">
			{agents.map((agent) => (
				<ConnectedAgentSection
					key={agent.clientId}
					agent={agent}
					onRevoke={setToRevoke}
				/>
			))}

			<ConfirmDestructiveDialog
				open={toRevoke !== null}
				onOpenChange={(open) => !open && setToRevoke(null)}
				plan={revokePlan}
				isPending={toRevoke !== null && pendingClientId === toRevoke.clientId}
				onConfirm={confirmRevoke}
			/>
		</div>
	)
}
