import { describe, expect, it } from 'vitest'

import { listConnectedAgents } from './connected-agents'

const consent = (id: string, name: string, grantedAt: string) => ({
	client: { id, name },
	granted_at: grantedAt
})

const grant = (oauthClientId: string, organizationId: string) => ({
	oauthClientId,
	organizationId,
	organizationName: `Org ${organizationId}`,
	scopes: ['projects:read' as const],
	createdAt: new Date('2026-10-01T00:00:00Z')
})

describe('listConnectedAgents', () => {
	it('is active with a consent and a grant in an organization the user is in', () => {
		expect(
			listConnectedAgents({
				consents: [consent('cli', 'Vectreal CLI', '2026-10-02T00:00:00Z')],
				grants: [grant('cli', 'org-1')],
				memberOrganizationIds: ['org-1']
			})
		).toEqual([
			{
				clientId: 'cli',
				clientName: 'Vectreal CLI',
				approvedAt: '2026-10-02T00:00:00Z',
				organizationName: 'Org org-1',
				scopes: ['projects:read'],
				status: 'active'
			}
		])
	})

	it('is inactive once the user has left the grant organization', () => {
		const [agent] = listConnectedAgents({
			consents: [consent('cli', 'Vectreal CLI', '2026-10-02T00:00:00Z')],
			grants: [grant('cli', 'org-1')],
			memberOrganizationIds: ['org-2']
		})
		expect(agent.status).toBe('inactive')
		expect(agent.organizationName).toBe('Org org-1')
	})

	it('is inactive for a consent with no grant behind it', () => {
		expect(
			listConnectedAgents({
				consents: [consent('cli', 'Vectreal CLI', '2026-10-02T00:00:00Z')],
				grants: [],
				memberOrganizationIds: ['org-1']
			})
		).toEqual([
			expect.objectContaining({
				clientId: 'cli',
				organizationName: null,
				scopes: [],
				status: 'inactive'
			})
		])
	})

	it('lists a grant Supabase holds no consent for, so it can be removed', () => {
		expect(
			listConnectedAgents({
				consents: [],
				grants: [grant('gone', 'org-1')],
				memberOrganizationIds: ['org-1']
			})
		).toEqual([
			{
				clientId: 'gone',
				clientName: null,
				approvedAt: '2026-10-01T00:00:00.000Z',
				organizationName: 'Org org-1',
				scopes: ['projects:read'],
				status: 'inactive'
			}
		])
	})

	it('pairs a consent with its grant by client id, not by name', () => {
		const agents = listConnectedAgents({
			consents: [
				consent('a', 'Same name', '2026-10-02T00:00:00Z'),
				consent('b', 'Same name', '2026-10-03T00:00:00Z')
			],
			grants: [grant('b', 'org-1')],
			memberOrganizationIds: ['org-1']
		})
		expect(
			agents.map(({ clientId, status }) => ({ clientId, status }))
		).toEqual([
			{ clientId: 'b', status: 'active' },
			{ clientId: 'a', status: 'inactive' }
		])
	})

	it('orders newest first by time, not by how the timestamp is written', () => {
		// 01:30+02:00 is 23:30 the day before in UTC, older than the grant's
		// midnight, though it sorts after it as text.
		const agents = listConnectedAgents({
			consents: [consent('older', 'Older', '2026-10-01T01:30:00+02:00')],
			grants: [grant('newer', 'org-1')],
			memberOrganizationIds: ['org-1']
		})
		expect(agents.map(({ clientId }) => clientId)).toEqual(['newer', 'older'])
	})
})
