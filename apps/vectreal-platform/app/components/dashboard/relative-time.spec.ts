import { formatRelativeTime } from './relative-time'

describe('formatRelativeTime', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it('hands over to the absolute date at 30 days', () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-10-02T12:00:00Z'))

		expect(formatRelativeTime('2026-08-01T12:00:00Z')).toBe('Aug 1, 2026')
	})
})
