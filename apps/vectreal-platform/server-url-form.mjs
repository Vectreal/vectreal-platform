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

/**
 * Whether a path is one this server will redirect a browser to.
 *
 * `toSinglePathForm` already strips what makes a path dangerous, but rewriting
 * a value is a weaker claim than checking it: the check states the property the
 * `Location` header actually needs, which is that the browser resolves it
 * against this host and no other. One leading slash, then segments containing
 * neither separator, so nothing that starts a host (`//host`, `/\host`) or a
 * scheme can pass. Anything else falls through to the request handler rather
 * than being redirected.
 */
export function isSafeRedirectPath(pathname) {
	return pathname === '/' || /^\/[^/\\]+(?:\/[^/\\]+)*$/.test(pathname)
}
