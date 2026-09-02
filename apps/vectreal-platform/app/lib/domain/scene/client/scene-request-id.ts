/**
 * Mints the id that ties one scene write to all of its uploads.
 *
 * Every request in a save or publish flow carries the same value, which is what
 * lets the server reclaim uploads whose commit never landed (see
 * `asset-reclaim.server.ts`) and what keys the idempotency and write-lock
 * records. A flow that omits it gets neither.
 */
export const createSceneRequestId = () =>
	typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
