import { describe, expect, it, vi } from 'vitest'

import { swallowRowReorderKey } from './reorder-handle'

const row = new EventTarget()
const handle = new EventTarget()

function keyOn(target: EventTarget, key: string) {
	return { key, target, currentTarget: row, preventDefault: vi.fn() }
}

describe('swallowRowReorderKey', () => {
	it.each([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])(
		'takes %j from a focused row, before framer can move it',
		(key) => {
			const event = keyOn(row, key)
			swallowRowReorderKey(event)
			expect(event.preventDefault).toHaveBeenCalledOnce()
		}
	)

	it('leaves the handle its arrow keys', () => {
		const event = keyOn(handle, 'ArrowDown')
		swallowRowReorderKey(event)
		expect(event.preventDefault).not.toHaveBeenCalled()
	})

	it('leaves the row keys framer does not reorder with', () => {
		const event = keyOn(row, 'Tab')
		swallowRowReorderKey(event)
		expect(event.preventDefault).not.toHaveBeenCalled()
	})
})
