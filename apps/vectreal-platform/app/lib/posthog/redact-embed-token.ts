/**
 * Strips embed API keys out of anything on its way to PostHog.
 *
 * An embed authenticates by a `token` query parameter, because an iframe cannot
 * set request headers. That makes the token part of `window.location.href` on
 * every `/embed` page - and PostHog attaches `$current_url` to every event it
 * sends, not only to `$pageview`. So the key was leaving the browser on each
 * captured event from an embed, and would have done so for any event added
 * later.
 *
 * Applied through `before_send` at init rather than at a capture site, for that
 * reason: there is no list of call sites to keep in step, and a property that
 * PostHog adds itself is covered too.
 *
 * Pure and free of any PostHog import, so the rules below are testable directly.
 */

const REDACTED = 'redacted'

/**
 * A `token` query parameter and its value, wherever it appears.
 *
 * `[?&]` anchors it to a real parameter position, so `mytoken=` and prose like
 * "failed: token=missing" are left alone. The value runs to the next `&`, `#`
 * or whitespace. Case-insensitive deliberately: over-redacting an analytics
 * property costs nothing, missing one costs a live credential.
 */
const TOKEN_PARAM = /([?&]token=)[^&#\s]*/gi

/**
 * The cheap reject, run before the rewrite on every string of every event.
 *
 * Deliberately **not** global. `TOKEN_PARAM` carries `/g` because it rewrites
 * every occurrence, and `String.replace` resets `lastIndex` for it. `.test()`
 * does not: a global regex used here would advance `lastIndex` on a match and
 * return false on the next call, so alternate values would sail through
 * unredacted.
 *
 * Case-insensitive, matching the regex it guards. A case-sensitive
 * `includes('token=')` here made the `i` flag below pointless - `?Token=` never
 * reached the rewrite at all.
 */
const HAS_TOKEN_PARAM = /token=/i

/**
 * The same value with any embed token in it replaced.
 *
 * Rewrites the parameter in place rather than parsing and re-serializing a URL,
 * for two reasons found in review:
 *
 *   - PostHog's autocapture records `$elements[].attr__href` from the raw
 *     `getAttribute('href')`, which can be relative. A parse-based version
 *     skipped anything `new URL()` could not take on its own, so a relative
 *     href carrying a token would have gone out intact the day someone put a
 *     link in the embed chrome.
 *   - `searchParams.set()` re-serializes the whole query with form-encoding
 *     rules, turning spaces into `+` and escaping characters the URL grammar
 *     leaves alone. Harmless, but it means reporting a URL the visitor never
 *     had.
 *
 * Matching is on the value, never on the property name. PostHog puts its own
 * project key in `properties.token` for ingestion, and stripping that by name
 * is a documented way to break every event with a 401.
 */
export function redactEmbedToken(value: string): string {
	// Cheap reject first: this runs on every string property of every event.
	if (!HAS_TOKEN_PARAM.test(value)) {
		return value
	}

	return value.replace(TOKEN_PARAM, `$1${REDACTED}`)
}

/**
 * The same properties, with any embed token in them replaced.
 *
 * Walks nested objects and arrays because PostHog nests some of what it sends -
 * `$set`, `$set_once`, and whatever a caller passes - and a token one level down
 * leaves the browser exactly as readily as one at the top.
 */
export function redactEmbedTokenFromProperties<T>(properties: T): T {
	if (typeof properties === 'string') {
		return redactEmbedToken(properties) as T
	}

	if (Array.isArray(properties)) {
		return properties.map((entry) => redactEmbedTokenFromProperties(entry)) as T
	}

	/*
	  Plain objects only. A Date, a RegExp or a class instance is returned as it
	  is rather than rebuilt as a bare object, which would silently change what
	  the caller passed.
	*/
	if (
		properties !== null &&
		typeof properties === 'object' &&
		Object.getPrototypeOf(properties) === Object.prototype
	) {
		return Object.fromEntries(
			Object.entries(properties).map(([key, value]) => [
				key,
				redactEmbedTokenFromProperties(value)
			])
		) as T
	}

	return properties
}
