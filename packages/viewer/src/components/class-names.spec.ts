import { describe, expect, it } from 'vitest'

import { cn, withHostClasses } from './class-names'

describe('cn', () => {
	it('merges prefixed classes', () => {
		expect(cn('vv:p-1 vv:h-full', 'vv:p-4')).toBe('vv:h-full vv:p-4')
	})
})

describe('withHostClasses', () => {
	const own =
		'vctrl-viewer vv:relative vv:h-full vv:w-full vv:p-1 vv:hover:bg-foreground/5'

	it('returns the viewer classes alone when the host passes none', () => {
		expect(withHostClasses(own, undefined)).toBe(own)
		expect(withHostClasses(own, '  ')).toBe(own)
	})

	it('drops a viewer class the host overrides', () => {
		expect(withHostClasses(own, 'h-96 absolute')).toBe(
			'vctrl-viewer vv:w-full vv:p-1 vv:hover:bg-foreground/5 h-96 absolute'
		)
	})

	it('drops a broader viewer class a narrower host class touches', () => {
		expect(withHostClasses(own, 'px-2')).not.toContain('vv:p-1')
	})

	it('drops a narrower viewer class a broader host class covers', () => {
		expect(withHostClasses('vv:flex vv:px-2', 'p-3')).toBe('vv:flex p-3')
	})

	it('keeps viewer classes under a different variant', () => {
		expect(withHostClasses(own, 'hidden md:block bg-red-500')).toBe(
			`${own} hidden md:block bg-red-500`
		)
		expect(withHostClasses(own, 'hover:bg-red-500')).not.toContain(
			'vv:hover:bg-foreground/5'
		)
	})

	it('keeps every viewer class when only host classes conflict among themselves', () => {
		expect(withHostClasses(own, 'mt-2 mt-4')).toBe(`${own} mt-2 mt-4`)
	})

	it('leaves classes that are not Tailwind utilities alone', () => {
		expect(withHostClasses(own, 'my-product-viewer')).toBe(
			`${own} my-product-viewer`
		)
	})
})
