// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PostHogIdentify } from './posthog-identify'

const identify = vi.fn()
vi.mock('../../lib/posthog/posthog-react', () => ({
	usePostHog: () => ({ identify })
}))
vi.mock('./consent-context', () => ({
	useConsent: () => ({ consent: { analytics: true } })
}))

beforeEach(() => identify.mockClear())

/**
 * Email addresses stay out of analytics. An account without a display name
 * shows its address as the name, so the name is checked too.
 */
describe('PostHogIdentify', () => {
	it('sends the display name', () => {
		render(<PostHogIdentify userId="u1" name="Jane Doe" />)
		expect(identify).toHaveBeenCalledWith('u1', { name: 'Jane Doe' })
	})

	it('sends no name when the name is an email address', () => {
		render(<PostHogIdentify userId="u1" name="jane.doe@example.com" />)
		expect(identify).toHaveBeenCalledWith('u1', undefined)
	})
})
