const SUPABASE_AUTH_COOKIE_PATTERN = /(?:^|;\s*)sb-[^=;]*-auth-token(?:\.\d+)?=/

export function hasSupabaseAuthCookie(cookieHeader: null | string): boolean {
	if (!cookieHeader) {
		return false
	}

	return SUPABASE_AUTH_COOKIE_PATTERN.test(cookieHeader)
}

/** Client only: whether a Supabase auth cookie is present on document.cookie. */
export function hasClientSupabaseAuthCookie(): boolean {
	if (typeof document === 'undefined') {
		return false
	}

	return hasSupabaseAuthCookie(document.cookie)
}
