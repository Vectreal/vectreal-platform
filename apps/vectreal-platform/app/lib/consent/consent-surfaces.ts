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

const CONSENT_FREE_SECTIONS = ['/embed'] as const

/*
  Matched as a whole section, and case-insensitively, the way React Router
  matches the routes that render there: `embed/*` also answers bare `/embed`
  and `/EMBED/...`, and both render inside the customer's iframe.
*/
export function shouldRenderConsentUi(pathname: string): boolean {
	const path = pathname.toLowerCase()
	return !CONSENT_FREE_SECTIONS.some(
		(section) => path === section || path.startsWith(`${section}/`)
	)
}
