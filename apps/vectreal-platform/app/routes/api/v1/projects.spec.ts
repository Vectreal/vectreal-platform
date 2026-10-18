import { apiSuccessSchema, projectListSchema } from '@vctrl/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loader } from './projects'

import type { Route } from './+types/projects'

const { authorizeAgentRequest, listOrganizationProjects } = vi.hoisted(() => ({
	authorizeAgentRequest: vi.fn(),
	listOrganizationProjects: vi.fn()
}))

vi.mock('../../../lib/domain/agent/agent-request.server', () => ({
	authorizeAgentRequest
}))
vi.mock('../../../lib/domain/project/project-repository.server', () => ({
	listOrganizationProjects
}))

const request = new Request('https://vectreal.com/api/v1/projects')

beforeEach(() => {
	authorizeAgentRequest.mockReset().mockResolvedValue({
		organizationId: 'org-from-grant',
		scopes: ['projects:read']
	})
	listOrganizationProjects
		.mockReset()
		.mockResolvedValue([{ id: 'project-1', name: 'Chairs' }])
})

describe('GET /api/v1/projects', () => {
	it("lists the grant's organization in the shape the SDK reads, without caching", async () => {
		const response = await loader({ request } as Route.LoaderArgs)

		expect(authorizeAgentRequest).toHaveBeenCalledWith(request, {
			scope: 'projects:read'
		})
		expect(listOrganizationProjects).toHaveBeenCalledWith('org-from-grant')
		expect(response.status).toBe(200)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		const body = await response.json()
		expect(apiSuccessSchema(projectListSchema).parse(body)).toEqual(body)
		expect(body.data).toEqual({
			projects: [{ id: 'project-1', name: 'Chairs' }]
		})
	})

	it('answers the gate refusal and reads nothing', async () => {
		const refusal = new Response(null, { status: 403 })
		authorizeAgentRequest.mockRejectedValue(refusal)

		await expect(loader({ request } as Route.LoaderArgs)).rejects.toBe(refusal)
		expect(listOrganizationProjects).not.toHaveBeenCalled()
	})
})
