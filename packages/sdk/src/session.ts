import { z } from 'zod'

/** `DELETE /api/v1/session`: the session the token belongs to has ended. */
export const endedSessionSchema = z.object({ signedOut: z.literal(true) })

export type EndedSession = z.infer<typeof endedSessionSchema>
