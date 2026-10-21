import { basename, extname, resolve } from 'node:path'

import {
	createProjectInputSchema,
	createSceneInputSchema,
	updateSceneSettingsInputSchema,
	VectrealApiError
} from '@vctrl/sdk'
import { z } from 'zod'

import { UsageError } from '../errors'
import { defineOperation, type OperationContext, projectFor } from './operation'

const projectId = z
	.string()
	.optional()
	.describe('The project; defaults to the one vectreal init linked.')
const sceneId = z
	.string()
	.min(1)
	.describe('The scene, as list_scenes names it.')
const filePath = z
	.string()
	.min(1)
	.describe('A GLB file on this machine; relative paths start at the project.')

/** The first four bytes of every binary glTF. */
const GLB_MAGIC = [0x67, 0x6c, 0x54, 0x46]

/** A local GLB's bytes, refused with a reason when it is not one. */
async function readGlb(path: string, context: OperationContext) {
	const absolute = resolve(context.projectDir, path)
	const bytes = await context.readFile(absolute)
	if (!GLB_MAGIC.every((byte, index) => bytes[index] === byte)) {
		throw new UsageError(
			`${absolute} is not a GLB (binary glTF). Convert it first, for example by opening it in the Vectreal publisher and downloading the GLB.`
		)
	}
	return { absolute, bytes }
}

const blobOf = (bytes: Uint8Array) =>
	new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'model/gltf-binary' })

export const whoami = defineOperation({
	name: 'whoami',
	title: 'Who am I',
	description:
		'The signed-in user, the organization the session acts in, its role, plan and granted scopes.',
	input: z.object({}),
	readOnly: true,
	destructive: false,
	run: async (_input, context) => context.client.me()
})

export const listProjects = defineOperation({
	name: 'list_projects',
	title: 'List projects',
	description: "The projects in the session's organization.",
	input: z.object({}),
	readOnly: true,
	destructive: false,
	run: async (_input, context) => context.client.projects()
})

export const createProject = defineOperation({
	name: 'create_project',
	title: 'Create a project',
	description: "Creates a project in the session's organization.",
	input: z.object({ name: createProjectInputSchema.shape.name }),
	readOnly: false,
	destructive: false,
	run: async ({ name }, context) => context.client.createProject({ name })
})

export const listScenes = defineOperation({
	name: 'list_scenes',
	title: 'List scenes',
	description:
		"A project's scenes, the most recently edited first, with each one's status.",
	input: z.object({ projectId }),
	readOnly: true,
	destructive: false,
	run: async (input, context) =>
		context.client.listScenes(projectFor(input.projectId, context))
})

export const createSceneFromFile = defineOperation({
	name: 'create_scene_from_file',
	title: 'Create a scene from a GLB',
	description:
		'Uploads a local GLB as a new draft scene, stored as it is (the "original" optimization preset). It has no thumbnail or baked shadow until it is first opened in the publisher. Publish it with publish_scene.',
	input: z.object({
		path: filePath,
		name: createSceneInputSchema.shape.name
			.optional()
			.describe('The scene name; defaults to the file name.'),
		projectId
	}),
	readOnly: false,
	destructive: false,
	run: async (input, context) => {
		const { absolute, bytes } = await readGlb(input.path, context)
		const name = input.name ?? basename(absolute, extname(absolute))
		return context.client.createScene(projectFor(input.projectId, context), {
			name,
			file: blobOf(bytes)
		})
	}
})

export const getSceneSettings = defineOperation({
	name: 'get_scene_settings',
	title: 'Read scene settings',
	description:
		'Every settings section of a scene (environment, controls, bounds, shadows, presentation, camera, hotspots, interactions, animation, normalization), defaults filled in.',
	input: z.object({ sceneId }),
	readOnly: true,
	destructive: false,
	run: async ({ sceneId }, context) => context.client.getSceneSettings(sceneId)
})

export const updateSceneSettings = defineOperation({
	name: 'update_scene_settings',
	title: 'Change scene settings',
	description:
		'Replaces the environment, controls, bounds, shadows or presentation sections sent; each section sent is stored whole with the keys it leaves out at their defaults, so read the section with get_scene_settings and send it back changed. Camera, hotspots, interactions, animation and normalization are read-only here. Live embeds show the change at once.',
	input: z.object({
		sceneId,
		settings: updateSceneSettingsInputSchema
	}),
	readOnly: false,
	destructive: false,
	run: async ({ sceneId, settings }, context) =>
		context.client.updateSceneSettings(sceneId, settings)
})

export const publishScene = defineOperation({
	name: 'publish_scene',
	title: 'Publish a scene',
	description:
		"Compresses a local GLB the way the publisher exports it (Draco geometry and KTX2 textures, each on unless turned off) and publishes it as what the scene's visitors load. Send the GLB the scene was created from. Publishing again replaces it.",
	input: z.object({
		sceneId,
		path: filePath,
		draco: z.boolean().default(true).describe('Compress geometry with Draco.'),
		ktx2: z.boolean().default(true).describe('Encode textures to KTX2.')
	}),
	readOnly: false,
	destructive: false,
	run: async ({ sceneId, path, draco, ktx2 }, context) => {
		const { bytes } = await readGlb(path, context)
		const exported = await context.exportForPublish(bytes, { draco, ktx2 })
		const published = await context.client.publishScene(sceneId, {
			file: blobOf(exported)
		})
		return {
			...published,
			bytes: { source: bytes.length, published: exported.length }
		}
	}
})

export const unpublishScene = defineOperation({
	name: 'unpublish_scene',
	title: 'Take a scene offline',
	description:
		'Takes a published scene offline: its embeds stop showing it until it is published again.',
	input: z.object({ sceneId }),
	readOnly: false,
	destructive: true,
	run: async ({ sceneId }, context) => context.client.unpublishScene(sceneId)
})

export const getEmbedSnippet = defineOperation({
	name: 'get_embed_snippet',
	title: 'Get the embed snippet',
	description:
		"The iframe and SDK snippets for a published scene, plus its preview URL. Creates an embed key when the scene's project has none that works, and adds any domains given to the sites allowed to show that project's embeds (with none, the embed shows on no customer site).",
	input: z.object({
		sceneId,
		domains: z
			.array(z.string().trim().min(1))
			.optional()
			.describe('Sites to allow, such as example.com or *.myshopify.com.')
	}),
	readOnly: false,
	destructive: false,
	// Keys and domains belong to the scene's project, which the server names;
	// the linked project may be another one.
	run: async ({ sceneId, domains = [] }, context) => {
		const { client } = context
		let { embed } = await client.getSceneEmbed(sceneId).catch(async (error) => {
			const projectId =
				error instanceof VectrealApiError && error.code === 'embed_key_required'
					? error.body?.projectId
					: undefined
			if (typeof projectId !== 'string') throw error
			const { embedKey } = await client.createEmbedKey(projectId, {
				name: 'Vectreal MCP'
			})
			return client.getSceneEmbed(sceneId, { keyId: embedKey.id })
		})

		const added = domains.filter(
			(domain) => !embed.allowedDomains.includes(domain)
		)
		if (added.length > 0) {
			const { allowedDomains } = await client.setAllowedDomains(
				embed.projectId,
				{ domains: [...embed.allowedDomains, ...added] }
			)
			embed = { ...embed, allowedDomains }
		}
		return { embed }
	}
})
