import { z } from 'zod'

/**
 * Every `/api/v1` body is one of two shapes, written by `ApiResponse` in
 * `@shared/utils`: `{ success: true, data }` or `{ success: false, error }`.
 *
 * The failure shape is loose because the server adds to it (`quota` today, more
 * codes than this client knows), and an older client should still
 * read the message.
 */
export const apiFailureSchema = z.looseObject({
	success: z.literal(false),
	error: z.string(),
	/** One of `API_ERROR_CODES` from a v1 route, or a code newer than them. */
	code: z.string().optional()
})

export type ApiFailure = z.infer<typeof apiFailureSchema>

export function apiSuccessSchema<Data extends z.ZodType>(data: Data) {
	return z.object({ success: z.literal(true), data })
}
