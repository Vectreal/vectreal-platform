import { cn } from './styling.utils'

describe('cn', () => {
	it('returns an empty string when no classes are provided', () => {
		expect(cn()).toBe('')
	})

	it('joins truthy values and ignores falsy values', () => {
		expect(cn('btn', false && 'hidden', undefined, null, 'active')).toBe(
			'btn active'
		)
	})

	it('merges tailwind conflict classes with the last class winning', () => {
		expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
	})
})
