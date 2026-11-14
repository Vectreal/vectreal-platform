import { describe, expect, it } from 'vitest'

import {
	AGENT_OPERATION_SCOPES,
	describeAgentScope
} from './agent-operation-scopes'
import { AGENT_SCOPE_DESCRIPTIONS, AGENT_SCOPES } from './agent-scopes'

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

	it('grants nothing no /api/v1 route serves: renaming, moving, folders, key rotation', () => {
		for (const operation of [
			'project:update',
			'scene:move',
			'scene-folder:create',
			'scene-folder:update',
			'scene-folder:move',
			'api-key:update',
			'api-key:revoke',
			'api-key:rotate'
		] as const) {
			expect(AGENT_OPERATION_SCOPES[operation], operation).toBeNull()
		}
	})
})

describe('the consent copy', () => {
	it('lists what each scope grants, and promises nothing else', () => {
		expect(AGENT_SCOPE_DESCRIPTIONS['projects:write'].description).toBe(
			'Create projects and upload a model as a new scene.'
		)
		for (const scope of AGENT_SCOPES) {
			const { description } = AGENT_SCOPE_DESCRIPTIONS[scope]
			expect(description).toBe(describeAgentScope(scope))
			expect(description, scope).not.toMatch(/rename|move|folder/i)
		}
	})

	it('gives every scope at least one thing to do', () => {
		for (const scope of AGENT_SCOPES) {
			expect(describeAgentScope(scope), scope).toMatch(/^[A-Z].+\.$/)
		}
	})
})
