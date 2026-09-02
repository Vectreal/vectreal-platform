/**
 * The name field is optional, and this is the file that says so.
 *
 * It used to be required at two characters, which rejected a submission before
 * the form ever reached Supabase. Nothing downstream needs it, so the only
 * thing that made it mandatory was this function.
 */

import { describe, expect, it } from 'vitest'

import { validateSignup } from './signup-validation'

function form(fields: Record<string, string>): FormData {
	const data = new FormData()
	for (const [key, value] of Object.entries(fields)) data.set(key, value)
	return data
}

const valid = {
	name: 'Jane Smith',
	email: 'jane@example.com',
	password: 'a-long-enough-password',
	confirm_password: 'a-long-enough-password',
	tos_accepted: 'on'
}

describe('validateSignup', () => {
	it('accepts a complete submission', () => {
		expect(validateSignup(form(valid)).errors).toEqual({})
	})

	it('accepts a submission with no name at all', () => {
		const { name, ...withoutName } = valid
		void name
		const { errors, data } = validateSignup(form(withoutName))

		expect(errors).toEqual({})
		expect(data.name).toBe('')
	})

	it.each(['', ' ', 'J'])(
		'accepts %j as a name, since the field is optional',
		(value) => {
			expect(validateSignup(form({ ...valid, name: value })).errors).toEqual({})
		}
	)

	it('still trims the name it was given', () => {
		expect(validateSignup(form({ ...valid, name: '  Jane  ' })).data.name).toBe(
			'Jane'
		)
	})

	/*
	  Everything below stayed required. Asserting each one individually so that
	  making the name optional cannot quietly take a neighbour with it.
	*/
	/*
	  Exact message, not just the key. The claim this extraction rests on is that
	  the four surviving rules came across byte-identical, and a presence-only
	  assertion would pass against any copy at all.
	*/
	it('rejects an address with no @', () => {
		expect(
			validateSignup(form({ ...valid, email: 'jane.example.com' })).errors
		).toEqual({ email: 'Please enter a valid email address.' })
	})

	it('rejects a password under eight characters', () => {
		const short = 'abc1234'
		expect(
			validateSignup(
				form({ ...valid, password: short, confirm_password: short })
			).errors
		).toHaveProperty('password')
	})

	it('rejects a confirmation that does not match', () => {
		expect(
			validateSignup(form({ ...valid, confirm_password: 'something-else' }))
				.errors
		).toHaveProperty('confirmPassword')
	})

	it('rejects an unchecked Terms box', () => {
		const { tos_accepted, ...withoutTos } = valid
		void tos_accepted
		expect(validateSignup(form(withoutTos)).errors).toHaveProperty('tos')
	})

	it('returns every failure at once rather than the first', () => {
		const { errors } = validateSignup(form({ email: 'nope', password: 'x' }))

		expect(Object.keys(errors).sort()).toEqual([
			'confirmPassword',
			'email',
			'password',
			'tos'
		])
	})
})
