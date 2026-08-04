import { describe, expect, it, vi } from 'vitest'
import { captureServerEvent } from '../app/lib/domain/analytics/server-events.server'
import { CONSENT_POLICY_VERSION } from '../app/constants/consent-policy'
import type { PostHog } from 'posthog-node'

function makePostHog() {
  return { capture: vi.fn() } as unknown as PostHog
}

/** Build a request carrying a consent cookie with the given choices. */
function requestWithConsent(choices: {
  functional?: boolean
  analytics: boolean
  marketing?: boolean
}) {
  const value = encodeURIComponent(
    JSON.stringify({
      version: CONSENT_POLICY_VERSION,
      choices: {
        necessary: true,
        functional: choices.functional ?? false,
        analytics: choices.analytics,
        marketing: choices.marketing ?? false,
      },
    })
  )
  return new Request('https://vectreal.com/', {
    headers: { cookie: `consent_prefs=${value}` },
  })
}

/** A visitor who has not answered the consent banner yet. */
function requestWithoutConsentCookie() {
  return new Request('https://vectreal.com/')
}

describe('captureServerEvent', () => {
  it('calls posthog.capture with client_type injected', () => {
    const posthog = makePostHog()
    captureServerEvent(posthog, requestWithConsent({ analytics: true }), 'user-123', {
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
    captureServerEvent(posthog, requestWithConsent({ analytics: true }), 'user-456', {
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
      captureServerEvent(
        undefined,
        requestWithConsent({ analytics: true }),
        'user-789',
        { name: 'user_signed_in', props: { method: 'oauth' } }
      )
    ).not.toThrow()
  })

  describe('analytics consent gate', () => {
    it('does not capture when analytics consent was declined', () => {
      const posthog = makePostHog()
      captureServerEvent(posthog, requestWithConsent({ analytics: false }), 'user-1', {
        name: 'user_signed_in',
        props: { method: 'email' },
      })
      expect(posthog.capture).not.toHaveBeenCalled()
    })

    it('does not capture when the banner has not been answered', () => {
      const posthog = makePostHog()
      captureServerEvent(posthog, requestWithoutConsentCookie(), 'user-2', {
        name: 'user_signed_up',
        props: { method: 'email' },
      })
      expect(posthog.capture).not.toHaveBeenCalled()
    })

    it('does not capture when the consent cookie is unparseable', () => {
      const posthog = makePostHog()
      const request = new Request('https://vectreal.com/', {
        headers: { cookie: 'consent_prefs=not-json' },
      })
      captureServerEvent(posthog, request, 'user-3', {
        name: 'user_signed_in',
        props: { method: 'email' },
      })
      expect(posthog.capture).not.toHaveBeenCalled()
    })

    it('gates contact events on analytics consent too', () => {
      const posthog = makePostHog()
      captureServerEvent(posthog, requestWithConsent({ analytics: false }), 'anon', {
        name: 'contact_form_submitted',
        props: { inquiry_type: 'sales' },
      })
      expect(posthog.capture).not.toHaveBeenCalled()

      captureServerEvent(posthog, requestWithConsent({ analytics: true }), 'anon', {
        name: 'contact_form_submitted',
        props: { inquiry_type: 'sales' },
      })
      expect(posthog.capture).toHaveBeenCalledTimes(1)
    })

    it('ignores functional consent when deciding on analytics', () => {
      const posthog = makePostHog()
      captureServerEvent(
        posthog,
        requestWithConsent({ functional: true, analytics: false }),
        'user-4',
        { name: 'user_signed_in', props: { method: 'email' } }
      )
      expect(posthog.capture).not.toHaveBeenCalled()
    })
  })
})
