// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useConsentedCapture } from './use-consented-capture'

const capture = vi.fn()
const consent = vi.hoisted(() => ({ analytics: false }))
vi.mock('@posthog/react', () => ({ usePostHog: () => ({ capture }) }))
vi.mock('../components/consent/consent-context', () => ({
	useConsent: () => ({ consent })
}))

beforeEach(() => capture.mockClear())

describe('useConsentedCapture', () => {
	it('sends nothing until analytics are accepted', () => {
		consent.analytics = false
		const { result } = renderHook(() => useConsentedCapture())
		result.current('newsroom_cta_clicked', { slug: 'a' })
		expect(capture).not.toHaveBeenCalled()
	})

	it('sends the event once they are', () => {
		consent.analytics = true
		const { result } = renderHook(() => useConsentedCapture())
		result.current('newsroom_cta_clicked', { slug: 'a' })
		expect(capture).toHaveBeenCalledWith('newsroom_cta_clicked', { slug: 'a' })
	})
})
