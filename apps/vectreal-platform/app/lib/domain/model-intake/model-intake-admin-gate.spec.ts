import { describe, expect, it, vi } from 'vitest'

import {
	canOpenIntakeAdmin,
	MODEL_INTAKE_ADMIN_FLAG,
	type IntakeFlagSource
} from './model-intake-admin-gate'

const flags = (answer: boolean | undefined | Error): IntakeFlagSource => ({
	isFeatureEnabled: vi.fn(async () => {
		if (answer instanceof Error) throw answer
		return answer
	})
})

const base = {
	userId: 'user-1',
	email: 'moritz@vectreal.com',
	isDevBuild: false
}

describe('canOpenIntakeAdmin', () => {
	it('opens only on an explicit true, asked with the email', async () => {
		const source = flags(true)
		expect(await canOpenIntakeAdmin({ ...base, flags: source })).toBe(true)
		expect(source.isFeatureEnabled).toHaveBeenCalledWith(
			MODEL_INTAKE_ADMIN_FLAG,
			'user-1',
			{ personProperties: { email: 'moritz@vectreal.com' } }
		)
	})

	it.each([
		['a false flag', flags(false)],
		['a missing flag', flags(undefined)],
		['a throwing client', flags(new Error('boom'))],
		['no client', null]
	])('denies on %s', async (_, source) => {
		expect(await canOpenIntakeAdmin({ ...base, flags: source })).toBe(false)
	})

	it('opens for any signed-in user in a development build', async () => {
		expect(
			await canOpenIntakeAdmin({ ...base, flags: null, isDevBuild: true })
		).toBe(true)
	})
})
