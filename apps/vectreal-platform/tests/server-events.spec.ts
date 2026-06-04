import { describe, expect, it, vi } from 'vitest'
import { captureServerEvent } from '../app/lib/domain/analytics/server-events.server'
import type { PostHog } from 'posthog-node'

function makePostHog() {
  return { capture: vi.fn() } as unknown as PostHog
}

describe('captureServerEvent', () => {
  it('calls posthog.capture with client_type injected', () => {
    const posthog = makePostHog()
    captureServerEvent(posthog, 'user-123', {
      name: 'user_signed_up',
      props: { method: 'oauth', referrer: 'https://google.com', utm_source: 'cpc' },
    })
    expect(posthog.capture).toHaveBeenCalledWith({
      distinctId: 'user-123',
      event: 'user_signed_up',
      properties: {
        client_type: 'web',
        method: 'oauth',
        referrer: 'https://google.com',
        utm_source: 'cpc',
      },
    })
  })

  it('calls posthog.capture without referral props when omitted', () => {
    const posthog = makePostHog()
    captureServerEvent(posthog, 'user-456', {
      name: 'user_signed_in',
      props: { method: 'email' },
    })
    expect(posthog.capture).toHaveBeenCalledWith({
      distinctId: 'user-456',
      event: 'user_signed_in',
      properties: { client_type: 'web', method: 'email' },
    })
  })

  it('is a no-op when posthog is undefined', () => {
    // Must not throw
    expect(() =>
      captureServerEvent(undefined, 'user-789', {
        name: 'user_signed_in',
        props: { method: 'oauth' },
      })
    ).not.toThrow()
  })
})
