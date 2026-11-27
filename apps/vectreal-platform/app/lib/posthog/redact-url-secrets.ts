/**
 * Strips what must never reach an analytics or log sink out of anything on its
 * way there: the embed API key a page URL carries, and every email address.
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
 * Email addresses go for a different reason: Vectreal keeps them out of
 * analytics entirely, whether or not the visitor consented. They are matched
 * by shape anywhere in a string, not by parameter name, because they arrive in
 * URLs (`?email=a%40b.com`), in error messages and in caller properties alike.
 *
 * The same function also cleans the server's request log (`server-app.mjs`)
 * and the error reports (`error-report.ts`), so one rule covers every sink.
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

/*
  Email addresses, found by a single pass rather than a regex.

  They arrive plain (`jane@example.com`), percent-encoded (`%40` is how
  `searchParams.set` writes the `@`, `j%C3%BCrgen` how it writes `jürgen`) and
  encoded again inside a URL that is itself a parameter value (`%2540` in a
  `next=`), to any depth. A regex covering all of that needs a percent escape
  as an alternative in several places, and every version of one written here
  either backtracked quadratically on a crafted URL (the server's request log
  runs this on URLs a stranger chose) or let a spelling through. The scan
  reads each escape, however deeply encoded, as one character, so it is linear
  and has nothing to backtrack.

  An address is a run of characters that can be in one, holding an `@` with
  a dot and a letter somewhere after it. So `pkg@1.2.3`, `@vctrl/viewer` and
  a Firefox stack frame (`fn@https://...`, where `:` ends the run) are left
  alone, while `jane@example.com's` and `jane@example.com_old` are caught:
  the run, not just the address, is what gets replaced. The whole run is replaced, so
  over-matching costs part of an analytics value and under-matching would send
  an address.
*/

/** `%`, then `25` any number of times, then two hex digits. */
const ESCAPE = /%(?:25)*([0-9A-Fa-f]{2})/y

/** The cheap reject: no `@`, plain or encoded, means no address. */
const HAS_AT = /@|%(?:25)*40/

/**
 * ASCII that can sit in an address without ending it. Everything a URL uses
 * as structure (`/ ? # & = :`), and space, comma and the like, ends a run.
 */
const ADDRESS_PUNCTUATION = new Set("._+-'!$%*^`{|}~")

const LETTER_OR_DIGIT = /[\p{L}\p{M}\p{N}]/u
/** A domain label that starts with a letter: `.de`, `.com`, `.xn--p1ai`. */
const DOT_THEN_LETTER = /\.[\p{L}\p{M}]/u

interface ScannedChar {
	/** The character it stands for: decoded, for an escape. */
	readonly char: string
	readonly length: number
}

/**
 * The character at `index`, reading an escape as the character it encodes.
 * An escaped byte above ASCII is part of a letter outside ASCII, so it is read
 * as one. Decoded as itself it would not always be: `é` is `%C3%A9`, and `©`
 * is no letter, so the run would end mid-name and leave it unredacted.
 */
function scanChar(value: string, index: number): ScannedChar {
	if (value[index] === '%') {
		ESCAPE.lastIndex = index
		const escape = ESCAPE.exec(value)
		if (escape) {
			const code = Number.parseInt(escape[1], 16)
			return {
				char: code >= 0x80 ? 'ü' : String.fromCharCode(code),
				length: escape[0].length
			}
		}
	}
	const char = String.fromCodePoint(value.codePointAt(index) ?? 0)
	return { char, length: char.length }
}

function canBeInAddress(char: string): boolean {
	return (
		char === '@' || ADDRESS_PUNCTUATION.has(char) || LETTER_OR_DIGIT.test(char)
	)
}

/** Whether a run of address characters (decoded) is an address. */
function isAddress(run: string): boolean {
	const at = run.indexOf('@')
	return at >= 0 && DOT_THEN_LETTER.test(run.slice(at + 1))
}

/** `value` with every email address in it replaced. */
function redactEmails(value: string): string {
	let result = ''
	let index = 0
	while (index < value.length) {
		const { char, length } = scanChar(value, index)
		if (!canBeInAddress(char)) {
			result += value.slice(index, index + length)
			index += length
			continue
		}

		// A run: as far as characters that can be in an address go.
		const start = index
		let decoded = ''
		while (index < value.length) {
			const next = scanChar(value, index)
			if (!canBeInAddress(next.char)) break
			decoded += next.char
			index += next.length
		}
		result += isAddress(decoded) ? REDACTED : value.slice(start, index)
	}
	return result
}

/**
 * The same value with any embed token or email address in it replaced.
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
export function redactUrlSecrets(value: string): string {
	// Cheap rejects first: this runs on every string property of every event.
	let redacted = value
	if (HAS_TOKEN_PARAM.test(redacted)) {
		redacted = redacted.replace(TOKEN_PARAM, `$1${REDACTED}`)
	}
	if (HAS_AT.test(redacted)) {
		redacted = redactEmails(redacted)
	}
	return redacted
}

/**
 * The same properties, with every key and value passed through
 * `redactUrlSecrets`.
 *
 * Keys too, because PostHog keys some objects by URL: heatmaps send
 * `$heatmap_data` keyed by `location.href`, past every value-level rule. Two
 * keys that differ only in a secret then become one, and the later wins.
 *
 * Walks nested objects and arrays because PostHog nests some of what it sends -
 * `$set`, `$set_once`, and whatever a caller passes - and a token one level down
 * leaves the browser exactly as readily as one at the top.
 */
export function redactUrlSecretsFromProperties<T>(properties: T): T {
	if (typeof properties === 'string') {
		return redactUrlSecrets(properties) as T
	}

	if (Array.isArray(properties)) {
		return properties.map((entry) => redactUrlSecretsFromProperties(entry)) as T
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
				redactUrlSecrets(key),
				redactUrlSecretsFromProperties(value)
			])
		) as T
	}

	return properties
}
