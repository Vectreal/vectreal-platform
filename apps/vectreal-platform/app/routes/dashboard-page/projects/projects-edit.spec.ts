/**
 * The project edit action saves the name and the allowed embed domains, and
 * nothing else: projects carry no slug, so a form posted by an older client
 * that still sends one changes nothing it names.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { action } from './projects-edit'

import type { Route } from './+types/projects-edit'

const { updateProject, ensureValidCsrfFormData } = vi.hoisted(() => ({
	updateProject: vi.fn(),
	ensureValidCsrfFormData: vi.fn()
}))

vi.mock('../../../db/client', () => ({ getDbClient: () => ({}) }))
vi.mock('../../../lib/http/csrf.server', () => ({ ensureValidCsrfFormData }))
vi.mock('../../../lib/domain/auth/auth-loader.server', () => ({
	loadAuthenticatedUser: vi.fn(async () => ({ user: { id: 'user-1' } }))
}))
vi.mock('../../../lib/domain/project/project-repository.server', () => ({
	getProject: vi.fn(),
	updateProject
}))
vi.mock('../../../lib/domain/user/user-repository.server', () => ({
	getUserOrganizations: vi.fn()
}))

function submit(fields: Record<string, string>) {
	const body = new FormData()
	for (const [key, value] of Object.entries(fields)) body.set(key, value)
	const request = new Request(
		'https://vectreal.com/dashboard/projects/project-1/edit',
		{ method: 'POST', body }
	)
	return action({
		request,
		params: { projectId: 'project-1' }
	} as unknown as Route.ActionArgs)
}

beforeEach(() => {
	updateProject.mockReset().mockResolvedValue({})
	ensureValidCsrfFormData.mockReset().mockResolvedValue(null)
})

describe('project edit action', () => {
	it('saves the name and domains, and ignores a slug an older form still sends', async () => {
		await submit({
			name: 'Storefront',
			slug: 'storefront',
			allowedEmbedDomains: 'shop.example'
		})

		expect(updateProject).toHaveBeenCalledWith(
			'project-1',
			{ name: 'Storefront', allowedEmbedDomains: 'shop.example' },
			'user-1'
		)
	})
})
