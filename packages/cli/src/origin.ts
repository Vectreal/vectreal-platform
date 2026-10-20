import { UsageError } from './errors'

export const DEFAULT_ORIGIN = 'https://vectreal.com'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * The origin a URL names, refused unless it is https. Plain http is allowed on
 * loopback only, for a local stack: anywhere else the token would cross the
 * network in the clear.
 */
export function normalizeOrigin(input: string): string {
	let url: URL
	try {
		url = new URL(input)
	} catch {
		throw new UsageError(`Not a URL: ${input}`)
	}
	const isLoopbackHttp =
		url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)
	if (url.protocol !== 'https:' && !isLoopbackHttp) {
		throw new UsageError(
			`${input} must use https (plain http only on localhost)`
		)
	}
	return url.origin
}

/** Where to sign in or call: the flag, then the environment, then the last login. */
export function resolveOrigin(sources: {
	flag?: string
	env?: string
	saved?: string
}): string {
	return normalizeOrigin(
		sources.flag || sources.env || sources.saved || DEFAULT_ORIGIN
	)
}
