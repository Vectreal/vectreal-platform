import { formatLimitCount, formatLimitValue } from './limit-format'

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
		expect(
			formatLimitValue('storage_bytes_total', 10 * 1024 * 1024 * 1024)
		).toBe('10 GB')
	})

	it('formats count limits plainly and null as Unlimited', () => {
		expect(formatLimitValue('scenes_total', 200)).toBe('200')
		expect(formatLimitValue('scenes_total', null)).toBe('Unlimited')
	})
})

describe('formatLimitCount', () => {
	it('drops the plural at one, where three plan limits already sit', () => {
		expect(formatLimitCount('projects_total', 1, 'project')).toBe('1 project')
		expect(formatLimitCount('projects_total', 2, 'project')).toBe('2 projects')
	})

	it('reads an unlimited count as a plural', () => {
		expect(formatLimitCount('scenes_total', null, 'scene')).toBe(
			'Unlimited scenes'
		)
	})

	/*
		The offer descriptions are English prose built into the JSON-LD during render
		on the server and again in the browser, so they pin the locale. Without it a
		German visitor hydrates a different string than the server sent.
	*/
	it('groups digits by the locale it is given, not by the default', () => {
		expect(formatLimitCount('scenes_total', 2000, 'scene', 'en-US')).toBe(
			'2,000 scenes'
		)
		expect(formatLimitCount('scenes_total', 2000, 'scene', 'de-DE')).toBe(
			'2.000 scenes'
		)
	})

	/*
		The storage branches format their own number and are the ones the offer
		descriptions actually reach, through `storage_bytes_total`. No storage tier
		groups its digits today - 500, 10 and 100 - so dropping the locale there
		would be invisible until a tier crossed a thousand.
	*/
	it('passes the locale into the storage branches too', () => {
		const tb = 1024 * 1024 * 1024 * 1024

		expect(formatLimitValue('storage_bytes_total', tb, 'en-US')).toBe(
			'1,024 GB'
		)
		expect(formatLimitValue('storage_bytes_total', tb, 'de-DE')).toBe(
			'1.024 GB'
		)
		expect(
			formatLimitValue('storage_bytes_per_scene', 2000 * 1024 * 1024, 'de-DE')
		).toBe('2.000 MB')

		// The sub-gigabyte fallback, which is the branch Free's own sentence takes.
		expect(
			formatLimitValue('storage_bytes_total', 1000 * 1024 * 1024, 'de-DE')
		).toBe('1.000 MB')
	})
})
