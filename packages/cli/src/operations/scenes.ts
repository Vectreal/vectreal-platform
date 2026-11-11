import { basename, extname, resolve } from 'node:path'

import { litLights, resolveLighting } from '@vctrl/core'
import {
	createProjectInputSchema,
	createSceneInputSchema,
	updateSceneSettingsInputSchema,
	VectrealApiError
} from '@vctrl/sdk'
import { z } from 'zod'

import { UsageError } from '../errors'
import { describeDocument } from './describe-model'
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

export const describeModel = defineOperation({
	name: 'describe_model',
	title: 'Describe a model',
	description:
		"A local GLB's size, meshes, materials and animation clips, read from the file without rendering it. `viewer` gives the scale and bounds where the viewer places the model (centered on x and z, resting on y = 0), the space hotspots and cameras use; pass sceneId to apply that scene's normalization, which is otherwise off.",
	input: z.object({
		path: filePath,
		sceneId: sceneId
			.optional()
			.describe(
				'A scene made from this file, whose normalization the viewer applies.'
			)
	}),
	readOnly: true,
	destructive: false,
	run: async (input, context) => {
		const { absolute, bytes } = await readGlb(input.path, context)
		const normalization = input.sceneId
			? (await context.client.getSceneSettings(input.sceneId)).settings
					.normalization
			: undefined
		return {
			file: absolute,
			bytes: bytes.byteLength,
			...describeDocument(await context.readModel(bytes), normalization)
		}
	}
})

export const getSceneSettings = defineOperation({
	name: 'get_scene_settings',
	title: 'Read scene settings',
	description:
		'Every settings section of a scene (lighting, environment, controls, bounds, shadows, presentation, camera, hotspots, interactions, animation, normalization), defaults filled in.',
	input: z.object({ sceneId }),
	readOnly: true,
	destructive: false,
	run: async ({ sceneId }, context) => context.client.getSceneSettings(sceneId)
})

export const updateSceneSettings = defineOperation({
	name: 'update_scene_settings',
	title: 'Change scene settings',
	description:
		"Replaces the lighting, environment, controls, bounds, shadows, presentation, camera or hotspots sections sent; each section sent replaces the stored one whole, so read it with get_scene_settings and send it back changed. Look sections are filled with defaults for the keys they leave out; camera and hotspots are not: a hotspot missing a required field is refused, and a camera without position, target and fov has no view of its own, so send all three. Interactions, animation and normalization are read-only here. Lighting supersedes environment and shadows: those two only show on a scene with no lighting section, so change lighting. lighting.environment.quality is 'compressed' (a gain map 7 to 25 times smaller than the HDR, so the scene lights up seconds sooner on a phone) or 'lossless' (the HDR); absent reads as 'lossless', and night-city, night-building and nature-moonlit load lossless either way. presentation.interactionStart is 'immediate' (visitors move the scene as it loads) or 'tap' (the viewer shows a \"Tap to rotate\" button, and until it is pressed, touches and the wheel scroll the page, which suits a scene in a scrolling page or a product gallery); absent reads as 'immediate'. presentation.locale ('en' or 'de') is the language of that button; absent, the visitor's browser decides. Camera: `cameras` is a non-empty list of { cameraId, name, kind ('scene' or 'hotspot'), position [x, y, z], target [x, y, z], fov (vertical degrees, between 0 and 180) } in the space describe_model's `viewer` gives. Every vector (position, target, rotation, worldPosition) may be sent as [x, y, z] or { x, y, z } of finite numbers and is stored as [x, y, z]. The scene opens on the first camera of kind 'scene' (or the first camera when none is), and `activeCameraId` is set to it whatever is sent. Cameras of kind 'scene' keep the order sent: it is the order the viewer's camera switcher and next/previous step through, so reorder them to change it, and move one to the front to make the scene open on it. `sceneTransition` is { type: 'linear' | 'object_avoidance' | 'none', duration (ms), easing }. Hotspots: each needs { id, name, worldPosition [x, y, z], visible, internalOnly, stylePreset ('dot', 'image' or 'svg') } and may carry body, linkUrl (https), payloadUrl, linkedCameraId, linkedAnimationClipId, sequenceIndex, occlusionEnabled and clickableWhenOccluded; keep the fields get_scene_settings returned. A new hotspot needs a new UUID: an id from another scene is refused. A linkedCameraId names a camera in the same scene, usually one of kind 'hotspot'. A camera that a hotspot or interaction still names cannot be removed, so send camera and hotspots together to change both ends. The scene's thumbnail is not recaptured. Live embeds show the change at once.",
	input: z.object({
		sceneId,
		settings: updateSceneSettingsInputSchema
	}),
	readOnly: false,
	destructive: false,
	run: async ({ sceneId, settings }, context) =>
		context.client.updateSceneSettings(sceneId, settings)
})

/** Baking raytraces on a GPU, which a terminal does not have. */
export const BAKED_OCCLUSION_WARNING =
	"This scene's lighting asks for a studio finish with depth (baked ambient occlusion), which only the Publisher can draw: it was published without it. Publish from the Publisher to add it, or set lighting.occlusion.mode to 'live' or 'off'."

/** The light maps are raytraced too. */
export const BAKED_LIGHTS_WARNING =
	"This scene's lighting asks for a studio finish with its studio lights (baked into a light map), which only the Publisher can draw: it was published with them live. Publish from the Publisher to add it, or set lighting.bake.lights to false."

/** What a scene's lighting asks to bake that this publish could not. */
function unbakedWarnings(
	settings: Parameters<typeof resolveLighting>[0]
): string[] {
	if (!settings) return []
	const lighting = resolveLighting(settings)
	return [
		...(lighting.occlusion.mode === 'baked' ? [BAKED_OCCLUSION_WARNING] : []),
		...(lighting.bake.lights && litLights(lighting).length > 0
			? [BAKED_LIGHTS_WARNING]
			: [])
	]
}

export const publishScene = defineOperation({
	name: 'publish_scene',
	title: 'Publish a scene',
	description:
		"Compresses a local GLB the way the publisher exports it (Draco geometry and KTX2 textures, each on unless turned off) and publishes it as what the scene's visitors load. Send the GLB the scene was created from. Publishing again replaces it. Ambient occlusion and studio lights the scene's lighting asks to bake are not baked here, which needs a GPU: the result warns, and publishing from the Publisher bakes them.",
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
		// Only for the warning: a scene whose settings cannot be read still publishes.
		const settings = await context.client
			.getSceneSettings(sceneId)
			.then((response) => response.settings)
			.catch(() => undefined)
		const exported = await context.exportForPublish(bytes, { draco, ktx2 })
		const published = await context.client.publishScene(sceneId, {
			file: blobOf(exported)
		})
		const warnings = unbakedWarnings(settings)
		return {
			...published,
			bytes: { source: bytes.length, published: exported.length },
			...(warnings.length > 0 ? { warnings } : {})
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
