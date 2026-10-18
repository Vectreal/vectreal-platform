import { describe, expect, it } from 'vitest'

import { meSchema } from './me'

const me = {
	user: { id: 'user-1', email: null },
	organization: { id: 'org-1', name: 'Acme', role: 'member' },
	client: { id: 'client-1' },
	scopes: ['projects:read'],
	plan: { plan: 'pro', billingState: 'active' }
}

describe('meSchema', () => {
	it('reads a scope, role and plan it has never heard of', () => {
		const later = {
			...me,
			organization: { ...me.organization, role: 'auditor' },
			scopes: ['projects:read', 'scenes:archive'],
			plan: { plan: 'team', billingState: 'paused' }
		}

		expect(meSchema.parse(later)).toEqual(later)
	})

	it('refuses a body missing a field', () => {
		const { client: _client, ...withoutClient } = me

		expect(meSchema.safeParse(withoutClient).success).toBe(false)
	})
})
