const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function normalizeHost(host: string): string {
	return host.toLowerCase().trim().replace(/\.+$/, '')
}

function normalizeHostInput(value: string): string {
	const trimmed = value.trim()
	if (!trimmed) {
		return ''
	}

	const maybeUrl = trimmed.includes('://') ? trimmed : `https://${trimmed}`
	try {
		const parsed = new URL(maybeUrl)
		return normalizeHost(parsed.hostname)
	} catch {
		return normalizeHost(trimmed.replace(/^\*\./, ''))
	}
}

function isValidHostname(hostname: string): boolean {
	if (!hostname || hostname.length > 253) {
		return false
	}

	if (LOCALHOST_HOSTS.has(hostname)) {
		return true
	}

	const labels = hostname.split('.')
	if (labels.length < 2) {
		return false
	}

	return labels.every(
		(label) =>
			/^[a-z0-9-]{1,63}$/.test(label) &&
			!label.startsWith('-') &&
			!label.endsWith('-')
	)
}

export function normalizeDomainPattern(value: string): string | null {
	const trimmed = value.trim()
	if (!trimmed) {
		return null
	}

	const hasWildcard = trimmed.startsWith('*.')
	if (trimmed.includes('*') && !hasWildcard) {
		return null
	}

	const hostname = normalizeHostInput(trimmed)
	if (!isValidHostname(hostname)) {
		return null
	}

	return hasWildcard ? `*.${hostname}` : hostname
}

export function parseAllowedDomainPatterns(
	rawValue: string | null | undefined
): string[] {
	if (!rawValue) {
		return []
	}

	const values = rawValue
		.split(/\r?\n|,/)
		.map((value) => value.trim())
		.filter(Boolean)

	const normalized = values
		.map((value) => normalizeDomainPattern(value))
		.filter((value): value is string => Boolean(value))

	return Array.from(new Set(normalized))
}

export function serializeAllowedDomainPatterns(
	patterns: string[]
): string | null {
	if (patterns.length === 0) {
		return null
	}

	return patterns.join('\n')
}

export function validateAllowedDomainInput(
	rawValue: string | null | undefined
):
	| {
			ok: true
			patterns: string[]
	  }
	| {
			ok: false
			message: string
	  } {
	if (!rawValue?.trim()) {
		return { ok: true, patterns: [] }
	}

	const values = rawValue
		.split(/\r?\n|,/)
		.map((value) => value.trim())
		.filter(Boolean)

	for (const value of values) {
		if (!normalizeDomainPattern(value)) {
			return {
				ok: false,
				message:
					'Allowed domains must be exact hosts or leading wildcard hosts (for example: example.com, *.example.com).'
			}
		}
	}

	return { ok: true, patterns: parseAllowedDomainPatterns(rawValue) }
}

export function isAllowedEmbedHost(
	hostname: string,
	patterns: string[]
): boolean {
	const normalizedHost = normalizeHost(hostname)

	if (patterns.length === 0) {
		return false
	}

	for (const pattern of patterns) {
		if (pattern.startsWith('*.')) {
			const suffix = pattern.slice(2)
			if (
				normalizedHost.length > suffix.length &&
				normalizedHost.endsWith(`.${suffix}`)
			) {
				return true
			}
			continue
		}

		if (normalizedHost === pattern) {
			return true
		}
	}

	return false
}

export function isLocalhostLike(hostname: string): boolean {
	const normalizedHost = normalizeHost(hostname)
	return (
		LOCALHOST_HOSTS.has(normalizedHost) ||
		normalizedHost.endsWith('.localhost') ||
		normalizedHost.endsWith('.local')
	)
}

export function extractHostFromHeader(value: string | null): string | null {
	if (!value) {
		return null
	}

	try {
		const parsed = new URL(value)
		return normalizeHost(parsed.hostname)
	} catch {
		return null
	}
}
