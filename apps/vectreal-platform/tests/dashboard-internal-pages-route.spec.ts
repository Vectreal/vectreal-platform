/**
 * The route the dashboard sidebar asks for its internal links. Each page is
 * answered by that page's own gate, and an expired session or a failed check
 * answers "nothing open", the same as the sidebar assumes until it hears back.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../app/lib/http/auth.server', () => ({ getAuthUser: vi.fn() }))
vi.mock('../app/lib/domain/img-to-3d/img-to-3d-access.server', () => ({
	isImgTo3dEnabledFor: vi.fn()
}))
vi.mock('../app/lib/domain/model-intake/model-intake-admin.server', () => ({
	isIntakeAdmin: vi.fn()
}))
vi.mock('../app/lib/observability/report-server-error.server', () => ({
	reportServerError: vi.fn()
}))

import { isImgTo3dEnabledFor } from '../app/lib/domain/img-to-3d/img-to-3d-access.server'
import { isIntakeAdmin } from '../app/lib/domain/model-intake/model-intake-admin.server'
import { getAuthUser } from '../app/lib/http/auth.server'
import { reportServerError } from '../app/lib/observability/report-server-error.server'
import { loader } from '../app/routes/api/dashboard.internal-pages'

import type { User } from '@supabase/supabase-js'
import type { LoaderFunctionArgs } from 'react-router'

const user = { id: 'user-1' } as User

async function ask() {
	const response = (await loader({
		request: new Request('https://vectreal.test/api/dashboard/internal-pages')
	} as unknown as LoaderFunctionArgs)) as Response
	return { response, body: await response.json() }
}

beforeEach(() => {
	vi.mocked(getAuthUser).mockReset().mockResolvedValue({ user })
	vi.mocked(isImgTo3dEnabledFor).mockReset().mockResolvedValue(false)
	vi.mocked(isIntakeAdmin).mockReset().mockResolvedValue(false)
	vi.mocked(reportServerError).mockReset()
})

describe('GET /api/dashboard/internal-pages', () => {
	it('answers each page from its own gate, for the signed-in user', async () => {
		vi.mocked(isImgTo3dEnabledFor).mockResolvedValue(true)

		const { response, body } = await ask()

		expect(response.status).toBe(200)
		expect(response.headers.get('Cache-Control')).toBe('private, no-store')
		expect(body).toEqual({
			success: true,
			data: { generations: true, intake: false }
		})
		expect(isImgTo3dEnabledFor).toHaveBeenCalledWith(user)
		expect(isIntakeAdmin).toHaveBeenCalledWith(user)
	})

	it('maps the intake gate to intake alone', async () => {
		vi.mocked(isIntakeAdmin).mockResolvedValue(true)

		const { body } = await ask()

		expect(body.data).toEqual({ generations: false, intake: true })
	})

	it('opens nothing, with a 200, when nobody is signed in', async () => {
		vi.mocked(getAuthUser).mockResolvedValue(
			new Response(null, { status: 401 })
		)
		vi.mocked(isImgTo3dEnabledFor).mockResolvedValue(true)
		vi.mocked(isIntakeAdmin).mockResolvedValue(true)

		const { response, body } = await ask()

		expect(response.status).toBe(200)
		expect(body.data).toEqual({ generations: false, intake: false })
		expect(isImgTo3dEnabledFor).not.toHaveBeenCalled()
	})

	it('opens nothing, with a 200, and reports it when a check throws', async () => {
		const failure = new Error('auth service down')
		vi.mocked(getAuthUser).mockRejectedValue(failure)

		const { response, body } = await ask()

		expect(response.status).toBe(200)
		expect(body.data).toEqual({ generations: false, intake: false })
		expect(reportServerError).toHaveBeenCalledWith(failure, expect.anything())
	})
})
