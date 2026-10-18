import { z } from 'zod'

/**
 * `GET /api/v1/projects`: the projects in the organization the grant names.
 *
 * An object rather than a bare array, so a cursor can join it without
 * breaking a client that reads `projects`.
 */
export const projectListSchema = z.object({
	projects: z.array(z.object({ id: z.string(), name: z.string() }))
})

export type ProjectList = z.infer<typeof projectListSchema>
