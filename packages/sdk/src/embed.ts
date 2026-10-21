import { z } from 'zod'

/**
 * One embed key, without its token. The token reaches a client only inside
 * `getSceneEmbed`'s answer, so it is never kept as a replayable response.
 */
export const embedKeySchema = z.object({
	id: z.string(),
	name: z.string(),
	/** The last characters of the token, for naming it without reading it. */
	keyPreview: z.string(),
	expiresAt: z.iso.datetime().nullable(),
	lastUsedAt: z.iso.datetime().nullable(),
	revoked: z.boolean(),
	expired: z.boolean(),
	/** Whether `getSceneEmbed` can build a snippet with it. */
	usable: z.boolean()
})

export type EmbedKey = z.infer<typeof embedKeySchema>

/** `GET /api/v1/projects/:projectId/embed-keys`: usable keys first. */
export const embedKeyListSchema = z.object({
	embedKeys: z.array(embedKeySchema)
})

export type EmbedKeyList = z.infer<typeof embedKeyListSchema>

/** `POST /api/v1/projects/:projectId/embed-keys`: what an agent sends. */
export const createEmbedKeyInputSchema = z.object({
	name: z.string().trim().min(1).max(100)
})

export type CreateEmbedKeyInput = z.infer<typeof createEmbedKeyInputSchema>

/** `POST /api/v1/projects/:projectId/embed-keys`: what it answers with, 201. */
export const createdEmbedKeySchema = z.object({ embedKey: embedKeySchema })

export type CreatedEmbedKey = z.infer<typeof createdEmbedKeySchema>

/**
 * `GET` and `PUT /api/v1/projects/:projectId/allowed-domains`: the sites that
 * may show the project's embeds, such as `example.com` or
 * `*.myshopify.com`. With none, the embed works on no customer site.
 */
export const allowedDomainsSchema = z.object({
	allowedDomains: z.array(z.string())
})

export type AllowedDomains = z.infer<typeof allowedDomainsSchema>

/** `PUT /api/v1/projects/:projectId/allowed-domains`: replaces the list. */
export const setAllowedDomainsInputSchema = z.object({
	domains: z.array(z.string())
})

export type SetAllowedDomainsInput = z.infer<
	typeof setAllowedDomainsInputSchema
>

/** `GET /api/v1/scenes/:sceneId/embed`: ready to paste, token included. */
export const sceneEmbedSchema = z.object({
	embed: z.object({
		/** The scene's project: the one its keys and allowed domains belong to. */
		projectId: z.string(),
		/** The key whose token the URL and snippets carry. */
		keyId: z.string(),
		/** The iframe URL a visitor's browser loads. */
		url: z.url(),
		iframeSnippet: z.string(),
		sdkSnippet: z.string(),
		/** Where the owner can see the scene signed in, without a key. */
		previewUrl: z.url(),
		/** Empty means the embed is refused on every customer site. */
		allowedDomains: z.array(z.string())
	})
})

export type SceneEmbed = z.infer<typeof sceneEmbedSchema>
