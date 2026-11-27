import type { CaptureResult } from 'posthog-js'

/**
 * What PostHog may receive about a visitor who has not accepted analytics,
 * and the one place that decides it. The privacy policy ("Counting without
 * consent") describes exactly this list; change one, change the other.
 *
 * Without a grant PostHog runs cookieless (`posthog-browser.ts`): it stores
 * nothing on the device and counts visitors by a hash it computes on its
 * servers from the IP address, user agent and host with a salt it deletes
 * daily. That covers who. This covers what: an allowlist of events, each
 * cut down to the properties named here, so a capture site cannot widen it
 * by passing more and an event PostHog raises on its own (autocapture,
 * clicks, web vitals, exceptions, `$set`) never leaves at all.
 *
 * Each event keeps its own properties below plus `SHARED`: the page path,
 * campaign parameters, the referring site, and what PostHog needs to accept
 * and hash the event. Dropped on every event: query strings (the address on
 * `/auth/confirm-pending?email=` is an email address), the referrer's path,
 * screen and viewport size, language, timezone, page title and person
 * properties.
 */
const COOKIELESS_EVENTS: Record<string, readonly string[]> = {
	$pageview: [],
	newsroom_listing_viewed: ['result_count', 'has_query', 'has_category_filter'],
	newsroom_article_viewed: ['slug', 'category', 'reading_time_minutes'],
	newsroom_cta_clicked: ['slug', 'destination', 'action'],
	scene_upload_succeeded: ['file_format', 'duration_ms']
}

/*
  PostHog's own fields. `token`, `distinct_id` and `$cookieless_mode` are
  what ingestion needs to accept the event and replace the placeholder id
  with its hash, which reads `$raw_user_agent` and `$host`. The browser,
  OS and device type are derived from the same user agent.
*/
const SHARED = [
	'token',
	'distinct_id',
	'$cookieless_mode',
	'$config_defaults',
	'$lib',
	'$lib_version',
	'$insert_id',
	'$time',
	'$process_person_profile',
	'$is_identified',
	'$raw_user_agent',
	'$browser',
	'$browser_version',
	'$os',
	'$os_version',
	'$device_type',
	'$host',
	'$pathname',
	'$referring_domain'
]

const CAMPAIGN_PARAMS = [
	'utm_source',
	'utm_medium',
	'utm_campaign',
	'utm_content',
	'utm_term'
]

/** `https://host/path?query#hash` to `https://host/path`. */
function withoutQuery(url: string): string | undefined {
	try {
		const { origin, pathname } = new URL(url)
		return origin + pathname
	} catch {
		return undefined
	}
}

/** A referrer's site, never the page on it. `$direct` passes as it is. */
function referrerSite(referrer: unknown): string | undefined {
	if (typeof referrer !== 'string') return undefined
	if (!referrer.startsWith('http')) return referrer
	try {
		return new URL(referrer).origin
	} catch {
		return undefined
	}
}

function campaign(url: unknown): Record<string, string> {
	if (typeof url !== 'string') return {}
	try {
		const { searchParams } = new URL(url)
		return Object.fromEntries(
			CAMPAIGN_PARAMS.flatMap((name) => {
				const value = searchParams.get(name)
				return value ? [[name, value]] : []
			})
		)
	} catch {
		return {}
	}
}

/**
 * The event as it may leave without consent, or `null` to drop it.
 * Only called for events PostHog marked `$cookieless_mode`.
 */
export function toCookielessEvent(event: CaptureResult): CaptureResult | null {
	const own = COOKIELESS_EVENTS[event.event]
	if (!own) return null

	const { properties } = event
	const kept = Object.fromEntries(
		[...SHARED, ...own].flatMap((name) =>
			name in properties ? [[name, properties[name]]] : []
		)
	)

	return {
		uuid: event.uuid,
		event: event.event,
		timestamp: event.timestamp,
		properties: {
			...kept,
			...campaign(properties.$current_url),
			$current_url: withoutQuery(String(properties.$current_url ?? '')),
			$referrer: referrerSite(properties.$referrer)
		}
	}
}
