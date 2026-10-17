import { consentsWithoutValidGrant } from './oauth-consent'

import type { AgentScope } from './agent-scopes'

/**
 * One approved agent as the dashboard lists it. An approval lives in two
 * places: Supabase's consent, which owns whether the agent's sessions are
 * valid, and our grant, which says what organization and scopes they act
 * with. A row exists when either does.
 *
 * `active` means the agent's next call can succeed: Supabase holds a consent
 * and the grant names an organization the user still belongs to, the same
 * rule the consent page withdraws stale consents by. Anything else is
 * `inactive`, listed so the user can remove what is left of it.
 */
export interface ConnectedAgent {
	clientId: string
	/** Null for a grant Supabase holds no consent for: only Supabase has the name. */
	clientName: string | null
	approvedAt: string
	organizationName: string | null
	scopes: AgentScope[]
	status: 'active' | 'inactive'
}

export function listConnectedAgents(input: {
	consents: ReadonlyArray<{
		client: { id: string; name: string }
		granted_at: string
	}>
	grants: ReadonlyArray<{
		oauthClientId: string
		organizationId: string
		organizationName: string
		scopes: AgentScope[]
		createdAt: Date
	}>
	memberOrganizationIds: readonly string[]
}): ConnectedAgent[] {
	const consentedClientIds = input.consents.map(({ client }) => client.id)
	const stale = new Set(
		consentsWithoutValidGrant({
			consentedClientIds,
			grants: input.grants,
			memberOrganizationIds: input.memberOrganizationIds
		})
	)
	const grantsByClient = new Map(
		input.grants.map((grant) => [grant.oauthClientId, grant])
	)

	const consented = input.consents.map(({ client, granted_at }) => {
		const grant = grantsByClient.get(client.id)
		return {
			clientId: client.id,
			clientName: client.name,
			approvedAt: granted_at,
			organizationName: grant?.organizationName ?? null,
			scopes: grant?.scopes ?? [],
			status: stale.has(client.id) ? 'inactive' : 'active'
		} satisfies ConnectedAgent
	})

	const consentedIds = new Set(consentedClientIds)
	const grantOnly = input.grants
		.filter(({ oauthClientId }) => !consentedIds.has(oauthClientId))
		.map(
			(grant) =>
				({
					clientId: grant.oauthClientId,
					clientName: null,
					approvedAt: grant.createdAt.toISOString(),
					organizationName: grant.organizationName,
					scopes: grant.scopes,
					status: 'inactive'
				}) satisfies ConnectedAgent
		)

	// Newest first. Parsed, not compared as text: Supabase's timestamps and
	// `toISOString` do not share a format.
	return [...consented, ...grantOnly].sort(
		(a, b) => Date.parse(b.approvedAt) - Date.parse(a.approvedAt)
	)
}
