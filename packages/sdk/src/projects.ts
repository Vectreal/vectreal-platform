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

/** `POST /api/v1/projects`: what an agent sends. Same name rule as the dashboard. */
export const createProjectInputSchema = z.object({
	name: z.string().trim().min(3).max(100)
})

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>

/** `POST /api/v1/projects`: what it answers with, 201. */
export const createdProjectSchema = z.object({
	project: z.object({ id: z.string(), name: z.string() })
})

export type CreatedProject = z.infer<typeof createdProjectSchema>
