const SUPABASE_AUTH_COOKIE_PATTERN = /(?:^|;\s*)sb-[^=;]*-auth-token(?:\.\d+)?=/

export function hasSupabaseAuthCookie(cookieHeader: null | string): boolean {
	if (!cookieHeader) {
		return false
	}

	return SUPABASE_AUTH_COOKIE_PATTERN.test(cookieHeader)
}
