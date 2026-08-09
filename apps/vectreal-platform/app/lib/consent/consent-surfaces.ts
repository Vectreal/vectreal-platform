/**
 * Where consent UI is allowed to appear.
 *
 * `/embed/*` renders inside somebody else's page. A cookie banner or a
 * preferences dialog appearing there is not a first-party consent prompt at
 * all: it is Vectreal chrome injected into a third party's site, over their
 * content, attributed to them. It must never render.
 *
 * Suppressing the UI does not grant consent. The consent cookie defaults to
 * denied, so an embed simply runs with no non-essential storage, which is the
 * correct posture for a third-party context.
 */

const CONSENT_FREE_PREFIXES = ['/embed/'] as const

export function shouldRenderConsentUi(pathname: string): boolean {
	return !CONSENT_FREE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}
