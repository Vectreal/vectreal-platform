import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveImgTo3dAccess } from './img-to-3d-access.server'
import { IMG_TO_3D_FLAG } from './img-to-3d-gate'

import type { User } from '@supabase/supabase-js'

const { posthog, flag } = vi.hoisted(() => {
	const flag = { value: true as unknown }
	return {
		flag,
		posthog: {
			evaluateFlags: vi.fn(async () => ({ getFlag: () => flag.value }))
		}
	}
})

vi.mock('../../posthog/posthog-client.server', () => ({
	getPosthogClient: () => posthog
}))
vi.mock('../user/user-repository.server', () => ({
	getOrCreateDefaultOrganization: async (userId: string) => ({
		id: `org-of-${userId}`
	})
}))

const user = { id: 'user-1', email: 'me@vectreal.com' } as User

beforeEach(() => {
	flag.value = true
	posthog.evaluateFlags.mockClear()
	vi.stubEnv('IMG_TO_3D_MOCK_MODE', 'false')
})

afterEach(() => {
	vi.unstubAllEnvs()
})

/**
 * The one function every route and the publisher loader ask. The handler
 * specs inject it, so this is where its own wiring is held.
 */
describe('resolveImgTo3dAccess', () => {
	it('charges the caller’s default organization when the flag lets them in', async () => {
		expect(await resolveImgTo3dAccess(user)).toEqual({
			organizationId: 'org-of-user-1'
		})
	})

	it('evaluates the flag for this user and that organization', async () => {
		await resolveImgTo3dAccess(user)

		expect(posthog.evaluateFlags).toHaveBeenCalledWith('user-1', {
			flagKeys: [IMG_TO_3D_FLAG],
			personProperties: {
				email: 'me@vectreal.com',
				organization_id: 'org-of-user-1'
			},
			groups: { organization: 'org-of-user-1' }
		})
	})

	it('refuses when the flag does', async () => {
		flag.value = false
		expect(await resolveImgTo3dAccess(user)).toBeNull()
	})

	it('lets everyone in under mock mode without asking PostHog', async () => {
		flag.value = false
		vi.stubEnv('IMG_TO_3D_MOCK_MODE', 'true')

		expect(await resolveImgTo3dAccess(user)).toEqual({
			organizationId: 'org-of-user-1'
		})
		expect(posthog.evaluateFlags).not.toHaveBeenCalled()
	})

	it('asks the flag in production even with mock mode set', async () => {
		flag.value = false
		vi.stubEnv('IMG_TO_3D_MOCK_MODE', 'true')
		vi.stubEnv('NODE_ENV', 'production')

		expect(await resolveImgTo3dAccess(user)).toBeNull()
	})
})
