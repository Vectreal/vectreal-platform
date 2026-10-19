import { createHash } from 'node:crypto'

/**
 * The pure half of agent idempotency: reading the key a request carries and
 * fingerprinting what it asked for. `agent-idempotency.server.ts` holds the
 * table and the flow.
 *
 * Follows draft-ietf-httpapi-idempotency-key-header: the key is an RFC 8941
 * String (`Idempotency-Key: "8e03978e-…"`). A bare token is accepted too,
 * because common clients send one, and it means the same thing.
 */

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key'

const MAX_KEY_LENGTH = 255

/** The key the request carries, or `null` when it carries none or a malformed one. */
export function readIdempotencyKey(request: Request): string | null {
	const raw = request.headers.get(IDEMPOTENCY_KEY_HEADER)?.trim()
	if (!raw) return null

	const key =
		raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2
			? unquote(raw.slice(1, -1))
			: /^[\x21-\x7e]+$/.test(raw) && !raw.includes('"')
				? raw
				: null

	return key && key.length <= MAX_KEY_LENGTH ? key : null
}

/** RFC 8941 sf-string content: printable ASCII, with `\"` and `\\` the only escapes. */
function unquote(content: string): string | null {
	let out = ''
	for (let index = 0; index < content.length; index += 1) {
		const char = content[index]
		if (char === '\\') {
			const next = content[index + 1]
			if (next !== '"' && next !== '\\') return null
			out += next
			index += 1
		} else if (char === '"' || char < ' ' || char > '~') {
			return null
		} else {
			out += char
		}
	}
	return out || null
}

/**
 * What the key was first sent with: method, path and the parsed body with its
 * keys sorted, so reordering a JSON object is the same request and changing a
 * value is not.
 */
export function fingerprintRequest(request: Request, payload: unknown): string {
	const { pathname } = new URL(request.url)
	return createHash('sha256')
		.update(`${request.method} ${pathname}\n${canonicalJson(payload)}`)
		.digest('hex')
}

function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
	if (value && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, entry]) => entry !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		return `{${entries
			.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
			.join(',')}}`
	}
	return JSON.stringify(value ?? null)
}
