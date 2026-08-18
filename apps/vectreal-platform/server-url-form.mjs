/**
 * Reduce a request path to the single form the server answers on.
 *
 * Kept apart from server.mjs so it can be tested without booting a server, and
 * written in plain JS because server.mjs runs under node with no build step.
 *
 * Collapsing the leading separators is load-bearing rather than cosmetic:
 * `//evil.com/` would otherwise normalize to `//evil.com`, which a browser
 * reads as protocol-relative and follows off-site, turning the canonical
 * redirect into an open redirect. Backslashes count as separators because
 * browsers normalize them to slashes, so `/\evil.com` is the same attack
 * wearing a different character.
 */
export function toSinglePathForm(pathname) {
	return pathname.replace(/[/\\]+$/, '').replace(/^[/\\]+/, '/') || '/'
}
