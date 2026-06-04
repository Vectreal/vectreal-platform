import type { PostHog } from 'posthog-node'

export type ServerAnalyticsEvent =
  | { name: 'user_signed_up';             props: { method: 'email' | 'oauth'; referrer?: string; utm_source?: string } }
  | { name: 'user_signed_in';             props: { method: 'email' | 'oauth' } }
  | { name: 'contact_form_submitted';     props: Record<string, unknown> }
  | { name: 'contact_form_submit_failed'; props: Record<string, unknown> }
  | { name: 'contact_form_blocked';       props: Record<string, unknown> }

export function captureServerEvent(
  posthog: PostHog | undefined,
  distinctId: string,
  event: ServerAnalyticsEvent
): void {
  posthog?.capture({
    distinctId,
    event: event.name,
    properties: { client_type: 'web', ...event.props },
  })
}
