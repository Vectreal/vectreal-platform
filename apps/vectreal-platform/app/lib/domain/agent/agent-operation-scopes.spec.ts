import { describe, expect, it } from 'vitest'

import { AGENT_OPERATION_SCOPES } from './agent-operation-scopes'

describe('AGENT_OPERATION_SCOPES', () => {
	it('grants agents nothing destructive, and nothing about members, settings or billing', () => {
		const granted = Object.entries(AGENT_OPERATION_SCOPES)
			.filter(([, scope]) => scope !== null)
			.map(([operation]) => operation)

		for (const operation of granted) {
			expect(operation, operation).not.toMatch(
				/:delete$|^organization|^billing/
			)
		}
	})

	it('creates a project with projects:write', () => {
		expect(AGENT_OPERATION_SCOPES['project:create']).toBe('projects:write')
	})
})
