import { z } from 'zod'

/**
 * `POST /api/v1/projects/:projectId/scenes`: the name the scene gets. The
 * model travels beside it as the multipart `file` field, one GLB.
 */
export const createSceneInputSchema = z.object({
	name: z.string().trim().min(1).max(100)
})

export type CreateSceneInput = z.infer<typeof createSceneInputSchema> & {
	/** One self-contained glTF 2.0 binary: every buffer and texture packed in. */
	file: Blob
}

/** `POST /api/v1/projects/:projectId/scenes`: what it answers with, 201. */
export const createdSceneSchema = z.object({
	scene: z.object({ id: z.string(), projectId: z.string(), name: z.string() })
})

export type CreatedScene = z.infer<typeof createdSceneSchema>
