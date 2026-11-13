/**
 * Every catalog keeps English's placeholders, so a translated message is
 * filled the same way. Its keys are checked by typecheck.
 */
import { describe, expect, it } from 'vitest'

import { de } from './de'
import { en, formatMessage } from './en'

const placeholders = (message: string) =>
	(message.match(/\{\w+\}/g) ?? []).sort()

describe('the viewer catalogs', () => {
	it.each(Object.entries({ de }))(
		'%s keeps every placeholder',
		(_, catalog) => {
			for (const key of Object.keys(en) as (keyof typeof en)[]) {
				expect(placeholders(catalog[key]), key).toEqual(placeholders(en[key]))
			}
		}
	)
})

describe('formatMessage', () => {
	it('fills each placeholder and leaves an unknown one', () => {
		expect(
			formatMessage('{name}, step {step} of {count}', {
				name: 'Seat',
				step: 2,
				count: 3
			})
		).toBe('Seat, step 2 of 3')
		expect(formatMessage('Viewing {name}', {})).toBe('Viewing {name}')
	})
})
