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

		expect(await authorizePreviewRequest(withKey(), 'p1')).toEqual({
			mode: 'apiKey',
			userId: null
		})
		expect(deps.getAuthUser).not.toHaveBeenCalled()
		expect(deps.validatePreviewApiKeyForProject).toHaveBeenCalledWith({
			request: expect.any(Request),
			projectId: 'p1'
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
			'p1'
		)) as Response

		expect(response.status).toBe(status)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
	})

	it('admits a signed-in user who can open the project, with their headers', async () => {
		const headers = new Headers({ 'Set-Cookie': 'session=1' })
		deps.getAuthUser.mockResolvedValue({ user: { id: 'u1' }, headers })
		deps.getProject.mockResolvedValue({ id: 'p1' })

		expect(await authorizePreviewRequest(withSession(), 'p1')).toEqual({
			mode: 'session',
			userId: 'u1',
			headers
		})
		expect(deps.getProject).toHaveBeenCalledWith('p1', 'u1')
	})

	it('tells a user outside the project the scene does not exist', async () => {
		deps.getAuthUser.mockResolvedValue({ user: { id: 'u1' }, headers: {} })
		deps.getProject.mockResolvedValue(null)

		const response = (await authorizePreviewRequest(
			withSession(),
			'p1'
		)) as Response

		expect(response.status).toBe(404)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
	})

	it('answers 404 with no session at all', async () => {
		deps.getAuthUser.mockResolvedValue(new Response(null, { status: 401 }))

		const response = (await authorizePreviewRequest(
			withSession(),
			'p1'
		)) as Response

		expect(response.status).toBe(404)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		expect(deps.getProject).not.toHaveBeenCalled()
	})
})
