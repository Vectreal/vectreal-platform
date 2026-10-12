/**
 * Whether session replay must stay off for a page, decided once at init.
 *
 * `/embed` is the one page whose URL carries a live API key: an iframe cannot
 * set request headers, so an embed authenticates by a `token` query parameter.
 * A replay records that URL in its rrweb meta events, and `before_send` cannot
 * redact it there - it skips `$snapshot` deliberately, because walking a whole
 * rrweb payload per snapshot costs far more than the rest of the redaction.
 * So replay is refused on the page instead of cleaned afterwards.
 *
 * Decided in the init config rather than by a URL blocklist in the PostHog
 * project, which lives outside the repo and would drift from the route table.
 * The client flag wins over remote config: posthog-js starts recording only
 * when `disable_session_recording` is false and the user has not opted out.
 *
 * Read from the path at init, which is enough: `/embed` is always a full
 * document load inside a host's iframe and never navigates to another route.
 */
export function isSessionReplayExcludedPath(pathname: string): boolean {
	return pathname === '/embed' || pathname.startsWith('/embed/')
}
