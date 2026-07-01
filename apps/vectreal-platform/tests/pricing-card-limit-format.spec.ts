import { formatLimitValue } from '../app/components/dashboard/billing/pricing-cards-section'

describe('formatLimitValue', () => {
	it('formats storage_bytes_per_scene as MB', () => {
		expect(formatLimitValue('storage_bytes_per_scene', 50 * 1024 * 1024)).toBe(
			'50 MB'
		)
	})

	it('formats a null per-scene limit as Custom', () => {
		expect(formatLimitValue('storage_bytes_per_scene', null)).toBe('Custom')
	})

	it('still formats storage_bytes_total as GB when >= 1 GB', () => {
		expect(formatLimitValue('storage_bytes_total', 10 * 1024 * 1024 * 1024)).toBe(
			'10 GB'
		)
	})

	it('formats count limits plainly and null as Unlimited', () => {
		expect(formatLimitValue('scenes_total', 200)).toBe('200')
		expect(formatLimitValue('scenes_total', null)).toBe('Unlimited')
	})
})
