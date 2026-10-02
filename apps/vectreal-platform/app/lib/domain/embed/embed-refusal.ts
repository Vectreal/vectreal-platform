import { data } from 'react-router'

import { EMBED_RESPONSE_HEADERS } from './embed-response-headers'

import type { EmbedRefusalReason } from '../../errors/error-state-copy'

/**
 * The status each refusal answers with. A malformed URL is the one exception,
 * answering 400 with the same `not_available` body as every 404.
 */
const EMBED_REFUSAL_STATUS: Record<EmbedRefusalReason, number> = {
	not_available: 404,
	domain_not_allowed: 403,
	busy: 429
}

/**
 * Every refusal the embed route makes, built one way, to be thrown.
 *
 * Thrown, not returned. A returned response is data to React Router: no
 * boundary runs, the document renders, the viewer boots into a spinner and
 * then fails its own fetch. Thrown, the embed layout's boundary renders the
 * refusal straight away.
 *
 * The body is the reason and nothing else. A missing credential, a key that
 * matched nothing and an unpublished scene all answer `not_available` with an
 * identical body, because telling them apart would tell whoever is looking at
 * someone else's broken embed whether a scene or key exists. And every
 * refusal carries the embed header contract: the URL may hold an API key.
 *
 * Pure, and outside the route, because `embed-layout.tsx` reaches
 * `getDbClient()` on import and no spec can load it without a database.
 */
export function embedRefusal(
	reason: EmbedRefusalReason,
	status: number = EMBED_REFUSAL_STATUS[reason]
) {
	return data({ reason }, { status, headers: EMBED_RESPONSE_HEADERS })
}
