import { beforeEach, describe, expect, it, vi } from 'vitest'

const deps = vi.hoisted(() => ({
	validatePreviewApiKeyForProject: vi.fn(),
	getAuthUser: vi.fn(),
	getProject: vi.fn()
}))

vi.mock('./preview-api-key-auth.server', () => ({
	validatePreviewApiKeyForProject: deps.validatePreviewApiKeyForProject
}))
vi.mock('../../http/auth.server', () => ({ getAuthUser: deps.getAuthUser }))
vi.mock('../project/project-repository.server', () => ({
	getProject: deps.getProject
}))

import { authorizePreviewRequest } from './preview-request-auth.server'

const PROJECT_ID = '5f3c1b2a-7e4d-4a9b-8c6f-1d2e3f4a5b6c'

const withKey = () =>
	new Request('https://vectreal.test/api/scenes/s?preview=1&token=key')
const withSession = () =>
	new Request('https://vectreal.test/api/scenes/s?preview=1')

beforeEach(() => {
	vi.clearAllMocks()
})

describe('authorizePreviewRequest', () => {
	it('admits a valid key holder without reading the session', async () => {
		deps.validatePreviewApiKeyForProject.mockResolvedValue({ ok: true })

		expect(await authorizePreviewRequest(withKey(), PROJECT_ID)).toEqual({
			mode: 'apiKey',
			userId: null
		})
		expect(deps.getAuthUser).not.toHaveBeenCalled()
		expect(deps.validatePreviewApiKeyForProject).toHaveBeenCalledWith({
			request: expect.any(Request),
			projectId: PROJECT_ID
		})
	})

	it.each([
		['rate_limited', 429],
		['domain_not_allowed', 403],
		['invalid', 404]
	])('answers a %s key %i, uncached', async (error, status) => {
		deps.validatePreviewApiKeyForProject.mockResolvedValue({ ok: false, error })

		const response = (await authorizePreviewRequest(
			withKey(),
			PROJECT_ID
		)) as Response

		expect(response.status).toBe(status)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
	})

	it('admits a signed-in user who can open the project', async () => {
		deps.getAuthUser.mockResolvedValue({ user: { id: 'u1' } })
		deps.getProject.mockResolvedValue({ id: PROJECT_ID })

		expect(await authorizePreviewRequest(withSession(), PROJECT_ID)).toEqual({
			mode: 'session',
			userId: 'u1'
		})
		expect(deps.getProject).toHaveBeenCalledWith(PROJECT_ID, 'u1')
	})

	it('tells a user outside the project the scene does not exist', async () => {
		deps.getAuthUser.mockResolvedValue({ user: { id: 'u1' } })
		deps.getProject.mockResolvedValue(null)

		const response = (await authorizePreviewRequest(
			withSession(),
			PROJECT_ID
		)) as Response

		expect(response.status).toBe(404)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
	})

	it('answers 404 with no session at all', async () => {
		deps.getAuthUser.mockResolvedValue(new Response(null, { status: 401 }))

		const response = (await authorizePreviewRequest(
			withSession(),
			PROJECT_ID
		)) as Response

		expect(response.status).toBe(404)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		expect(deps.getProject).not.toHaveBeenCalled()
	})

	it.each([
		['a key holder', withKey],
		['a signed-in user', withSession]
	])(
		'tells %s a malformed project id the scene does not exist, querying nothing',
		async (_caller, request) => {
			const response = (await authorizePreviewRequest(
				request(),
				'not-a-uuid'
			)) as Response

			expect(response.status).toBe(404)
			expect(response.headers.get('Cache-Control')).toBe('no-store')
			expect(deps.validatePreviewApiKeyForProject).not.toHaveBeenCalled()
			expect(deps.getProject).not.toHaveBeenCalled()
		}
	)
})
