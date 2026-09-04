/**
 * What a hotspot is allowed to point at.
 *
 * `payloadUrl` was added to the type and to the `payload_url` column without
 * ever being added to the save parser, so it was the one hotspot field that
 * reached Postgres unexamined. That is not currently exploitable - the value
 * only ever lands in an `<img src>`, where `javascript:` is inert and
 * `data:text/html` fails image decode - but it is the one field with no rule,
 * and the rule is what the next URL-shaped field inherits rather than
 * reinventing.
 */

/**
 * Ceiling on a stored URL, in characters.
 *
 * `payload_url` is an unbounded `text` column and an inline `data:` URI has no
 * natural size, so a handful of hotspots carrying full-resolution artwork can
 * make a scene's settings row larger than the model it describes.
 */
export const MAX_HOTSPOT_URL_LENGTH = 8192

const ALLOWED_IMAGE_MEDIA_TYPES = [
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/gif',
	'image/svg+xml'
]

/**
 * A `data:` URI's media type ends at either a parameter or the payload.
 *
 * RFC 2397 is `data:<mediatype>[;base64],<data>`, so the separator is a comma
 * when there is no parameter. Matching only on `;` rejected
 * `data:image/svg+xml,%3Csvg...` - the canonical inline SVG, and the form the
 * style preset exists to carry.
 */
const dataMediaType = (value: string): string =>
	value.slice('data:'.length).split(/[;,]/, 1)[0]

/**
 * A marker's artwork: an `https:` URL, or an inline image.
 *
 * `http:` is rejected because the embed runs inside somebody else's page, and a
 * mixed-content request there fails silently rather than visibly.
 */
export function isAllowedHotspotPayloadUrl(value: string): boolean {
	if (value.length > MAX_HOTSPOT_URL_LENGTH) return false

	// Schemes and media types are case-insensitive per RFC 3986 and RFC 2045.
	const normalized = value.toLowerCase()

	if (normalized.startsWith('data:')) {
		return ALLOWED_IMAGE_MEDIA_TYPES.includes(dataMediaType(normalized))
	}

	return (
		normalized.startsWith('https://') && value.length > 'https://'.length
	)
}
