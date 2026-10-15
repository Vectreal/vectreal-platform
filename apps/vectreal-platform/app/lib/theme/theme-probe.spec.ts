// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import { observeTheme } from './theme-probe'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('observeTheme', () => {
	it('calls back when the class on <html> changes, until stopped', async () => {
		const onChange = vi.fn()
		const stop = observeTheme(onChange)

		document.documentElement.classList.add('dark')
		await flush()
		expect(onChange).toHaveBeenCalledTimes(1)

		document.documentElement.setAttribute('data-other', '1')
		await flush()
		expect(onChange).toHaveBeenCalledTimes(1)

		stop()
		document.documentElement.classList.remove('dark')
		await flush()
		expect(onChange).toHaveBeenCalledTimes(1)
	})
})
