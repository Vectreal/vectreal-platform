/**
 * Any `/api/v1` path no route serves: a typo, or a client newer than this
 * server. Without it such a path fell through to the page routes and answered
 * their HTML 404, outside the v1 layout, with no code for the SDK to read.
 *
 * Answers a bare 404 for every method; the layout's envelope middleware codes
 * it, so the wording has one owner.
 */
const notFound = () => new Response(null, { status: 404 })

export const loader = notFound
export const action = notFound
