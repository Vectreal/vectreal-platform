import { describe, expect, it, vi } from 'vitest'

import {
	IMG_TO_3D_FLAG,
	isImgTo3dEnabled,
	isImgTo3dMockMode,
	type ImgTo3dFlagSource
} from './img-to-3d-gate'

const subject = {
	userId: 'user-1',
	email: 'me@vectreal.com',
	organizationId: 'org-1'
}

function source(flag: unknown): ImgTo3dFlagSource {
	return {
		evaluateFlags: vi.fn(async () => ({
			getFlag: (key: string) => (key === IMG_TO_3D_FLAG ? flag : undefined)
		}))
	}
}

/**
 * Every generation spends GPU money, so the failure this guards against is a
 * flag that could not be read counting as permission.
 */
describe('isImgTo3dEnabled', () => {
	it('allows only when the flag evaluates to exactly true', async () => {
		expect(await isImgTo3dEnabled(source(true), subject)).toBe(true)
	})

	it.each([
		['off', false],
		['a variant string', 'test'],
		['missing from the project', undefined]
	])('denies when the flag is %s', async (_, flag) => {
		expect(await isImgTo3dEnabled(source(flag), subject)).toBe(false)
	})

	it('denies without a PostHog client', async () => {
		expect(await isImgTo3dEnabled(null, subject)).toBe(false)
		expect(await isImgTo3dEnabled(undefined, subject)).toBe(false)
	})

	it('denies when evaluation fails', async () => {
		const failing: ImgTo3dFlagSource = {
			evaluateFlags: async () => {
				throw new Error('network')
			}
		}
		expect(await isImgTo3dEnabled(failing, subject)).toBe(false)
	})

	it('evaluates with the properties a release condition targets, supplied by the server', async () => {
		const flags = source(true)
		await isImgTo3dEnabled(flags, subject)

		expect(flags.evaluateFlags).toHaveBeenCalledWith('user-1', {
			flagKeys: [IMG_TO_3D_FLAG],
			personProperties: {
				email: 'me@vectreal.com',
				organization_id: 'org-1'
			},
			groups: { organization: 'org-1' }
		})
	})

	it('leaves the email property out rather than sending an empty one', async () => {
		const flags = source(true)
		await isImgTo3dEnabled(flags, { ...subject, email: null })

		expect(flags.evaluateFlags).toHaveBeenCalledWith(
			'user-1',
			expect.objectContaining({
				personProperties: { organization_id: 'org-1' }
			})
		)
	})
})

describe('isImgTo3dMockMode', () => {
	it('is on when asked for outside production', () => {
		expect(
			isImgTo3dMockMode({
				IMG_TO_3D_MOCK_MODE: 'true',
				NODE_ENV: 'development'
			})
		).toBe(true)
	})

	it('is never on in production, whatever the env var says', () => {
		expect(
			isImgTo3dMockMode({ IMG_TO_3D_MOCK_MODE: 'true', NODE_ENV: 'production' })
		).toBe(false)
	})

	it.each([undefined, 'false', '1', 'TRUE'])(
		'is off when the env var is %s',
		(value) => {
			expect(
				isImgTo3dMockMode({
					IMG_TO_3D_MOCK_MODE: value,
					NODE_ENV: 'development'
				})
			).toBe(false)
		}
	)
})
