import { VectrealApiError, type VectrealClient } from '@vctrl/sdk'
import { describe, expect, it, vi } from 'vitest'

import { UsageError } from '../errors'
import { corners, glbOf, meshDocument } from '../test-support'
import { parseDocPages, readDoc, searchDocPages, searchDocs } from './docs'
import { OPERATIONS, type Operation, type OperationContext } from './index'
import { readModelInNode } from './publish-export'
import { BAKED_LIGHTS_WARNING, BAKED_OCCLUSION_WARNING } from './scenes'

const GLB = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0])
const EXPORTED = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 9])
const embed = {
	embed: {
		projectId: 'p-scene',
		keyId: 'k1',
		url: 'https://x.test/embed',
		allowedDomains: ['a.test']
	}
}

function fakeContext(overrides: Partial<OperationContext> = {}) {
	const client = {
		listScenes: vi.fn(async () => ({ scenes: [] })),
		createScene: vi.fn(async () => ({ scene: { id: 's1' } })),
		publishScene: vi.fn(async () => ({ publication: { status: 'published' } })),
		getSceneEmbed: vi.fn(async () => embed),
		getSceneSettings: vi.fn(async () => ({
			settings: { normalization: { enabled: true, minSize: 0.5, maxSize: 5 } }
		})),
		createEmbedKey: vi.fn(async () => ({ embedKey: { id: 'k-new' } })),
		setAllowedDomains: vi.fn(
			async (_project: string, { domains }: { domains: string[] }) => ({
				allowedDomains: domains
			})
		)
	}
	const files = new Map<string, Uint8Array>([['/work/models/chair.glb', GLB]])
	const context: OperationContext = {
		origin: 'https://vectreal.test',
		client: client as unknown as VectrealClient,
		defaultProjectId: 'p-linked',
		projectDir: '/work',
		fetch: vi.fn(),
		readFile: vi.fn(async (path: string) => {
			const bytes = files.get(path)
			if (!bytes) throw new Error(`ENOENT: ${path}`)
			return bytes
		}),
		exportForPublish: vi.fn(async () => EXPORTED),
		readModel: readModelInNode,
		...overrides
	}
	return { context, client, files }
}

const operation = (name: string): Operation => {
	const found = OPERATIONS.find((candidate) => candidate.name === name)
	if (!found) throw new Error(`No operation ${name}`)
	return found
}

/** Runs an operation as a server does: the input parsed first, defaults applied. */
const call = (name: string, input: unknown, context: OperationContext) => {
	const op = operation(name)
	return op.run(op.input.parse(input), context)
}

describe('operations', () => {
	it('have unique names, and only unpublish is destructive', () => {
		const names = OPERATIONS.map(({ name }) => name)
		expect(new Set(names).size).toBe(names.length)
		expect(
			OPERATIONS.filter(({ destructive }) => destructive).map(
				({ name }) => name
			)
		).toEqual(['unpublish_scene'])
	})

	it('use the linked project when a call names none, and say how to link one', async () => {
		const { context, client } = fakeContext()

		await call('list_scenes', {}, context)
		await call('list_scenes', { projectId: 'p-named' }, context)

		expect(client.listScenes.mock.calls).toEqual([['p-linked'], ['p-named']])
		await expect(
			call('list_scenes', {}, { ...context, defaultProjectId: undefined })
		).rejects.toThrow(
			new UsageError(
				'No project: pass projectId, or run vectreal init in /work.'
			)
		)
	})
})

describe('create_scene_from_file', () => {
	it('uploads a GLB from the project directory, named after the file', async () => {
		const { context, client } = fakeContext()

		await call('create_scene_from_file', { path: 'models/chair.glb' }, context)

		const [projectId, input] = client.createScene.mock.calls[0] as unknown as [
			string,
			{ name: string; file: Blob }
		]
		expect(projectId).toBe('p-linked')
		expect(input.name).toBe('chair')
		expect(new Uint8Array(await input.file.arrayBuffer())).toEqual(GLB)
	})

	it('refuses a file that is not a GLB before uploading anything', async () => {
		const { context, client, files } = fakeContext()
		files.set('/work/chair.gltf', new TextEncoder().encode('{"asset":{}}'))

		await expect(
			call('create_scene_from_file', { path: 'chair.gltf' }, context)
		).rejects.toThrow(/not a GLB/)
		expect(client.createScene).not.toHaveBeenCalled()
	})
})

describe('describe_model', () => {
	it("reads a local GLB without signing in, and applies a named scene's normalization", async () => {
		const { context, client, files } = fakeContext()
		// 20 units tall: past the 5-unit cap, so normalization changes the scale.
		const tower = await glbOf(
			meshDocument(corners([0, 0, 0], [1, 20, 1])).document
		)
		files.set('/work/models/tower.glb', tower)

		const plain = (await call(
			'describe_model',
			{ path: 'models/tower.glb' },
			context
		)) as { file: string; bytes: number; viewer: { scale: number } }
		expect(plain).toMatchObject({
			file: '/work/models/tower.glb',
			bytes: tower.byteLength,
			viewer: { scale: 1, normalization: false }
		})
		expect(client.getSceneSettings).not.toHaveBeenCalled()

		const scaled = (await call(
			'describe_model',
			{ path: 'models/tower.glb', sceneId: 's1' },
			context
		)) as { viewer: { scale: number; normalization: boolean } }
		expect(client.getSceneSettings).toHaveBeenCalledWith('s1')
		expect(scaled.viewer.normalization).toBe(true)
		expect(scaled.viewer.scale).toBeLessThan(1)
	})

	it('refuses a file that is not a GLB, and is a read', async () => {
		const { context, files } = fakeContext()
		files.set('/work/models/chair.obj', new TextEncoder().encode('v 0 0 0'))

		await expect(
			call('describe_model', { path: 'models/chair.obj' }, context)
		).rejects.toThrow(UsageError)
		expect(operation('describe_model').readOnly).toBe(true)
	})
})

describe('publish_scene', () => {
	it('publishes the export of the GLB, Draco and KTX2 on unless turned off', async () => {
		const { context, client } = fakeContext()

		const result = await call(
			'publish_scene',
			{ sceneId: 's1', path: '/work/models/chair.glb' },
			context
		)
		await call(
			'publish_scene',
			{ sceneId: 's1', path: 'models/chair.glb', ktx2: false },
			context
		)

		expect(vi.mocked(context.exportForPublish).mock.calls).toEqual([
			[GLB, { draco: true, ktx2: true }],
			[GLB, { draco: true, ktx2: false }]
		])
		const [sceneId, { file }] = client.publishScene.mock
			.calls[0] as unknown as [string, { file: Blob }]
		expect(sceneId).toBe('s1')
		expect(new Uint8Array(await file.arrayBuffer())).toEqual(EXPORTED)
		expect(result).toMatchObject({ bytes: { source: 8, published: 5 } })
		expect(result).not.toHaveProperty('warnings')
	})

	it("warns that it cannot bake the occlusion the scene's lighting asks for", async () => {
		const { context, client } = fakeContext()
		client.getSceneSettings.mockResolvedValueOnce({
			settings: { lighting: { occlusion: { mode: 'baked' } } }
		} as never)

		const result = await call(
			'publish_scene',
			{ sceneId: 's1', path: 'models/chair.glb' },
			context
		)

		expect(client.getSceneSettings).toHaveBeenCalledWith('s1')
		expect(client.publishScene).toHaveBeenCalledOnce()
		expect(result).toMatchObject({ warnings: [BAKED_OCCLUSION_WARNING] })
	})

	it('warns that it cannot bake the studio lights either', async () => {
		const { context, client } = fakeContext()
		client.getSceneSettings.mockResolvedValueOnce({
			settings: {
				lighting: {
					occlusion: { mode: 'baked' },
					lights: [{ role: 'key' }],
					bake: { lights: true }
				}
			}
		} as never)

		const result = await call(
			'publish_scene',
			{ sceneId: 's1', path: 'models/chair.glb' },
			context
		)

		expect(result).toMatchObject({
			warnings: [BAKED_OCCLUSION_WARNING, BAKED_LIGHTS_WARNING]
		})
	})

	it('still publishes when the settings it checks cannot be read', async () => {
		const { context, client } = fakeContext()
		client.getSceneSettings.mockRejectedValueOnce(new Error('No such scene.'))

		const result = await call(
			'publish_scene',
			{ sceneId: 's1', path: 'models/chair.glb' },
			context
		)

		expect(client.publishScene).toHaveBeenCalledOnce()
		expect(result).not.toHaveProperty('warnings')
	})
})

describe('get_embed_snippet', () => {
	const refusal = (code: string, message: string, extra = {}) =>
		new VectrealApiError(409, message, {
			success: false,
			error: message,
			code,
			...extra
		})

	it("creates a key in the scene's project, which the server names, when it has none that works", async () => {
		const { context, client } = fakeContext()
		client.getSceneEmbed.mockRejectedValueOnce(
			refusal('embed_key_required', 'No key works.', { projectId: 'p-scene' })
		)

		expect(await call('get_embed_snippet', { sceneId: 's1' }, context)).toEqual(
			embed
		)
		expect(client.createEmbedKey).toHaveBeenCalledWith('p-scene', {
			name: 'Vectreal MCP'
		})
		expect(client.getSceneEmbed.mock.calls).toEqual([
			['s1'],
			['s1', { keyId: 'k-new' }]
		])
	})

	it('passes any other refusal on, creating nothing', async () => {
		const { context, client } = fakeContext()
		const draft = refusal('scene_not_published', 'The scene is a draft.')
		const unnamed = refusal('embed_key_required', 'No key works.')
		client.getSceneEmbed
			.mockRejectedValueOnce(draft)
			.mockRejectedValueOnce(unnamed)

		await expect(
			call('get_embed_snippet', { sceneId: 's1' }, context)
		).rejects.toBe(draft)
		await expect(
			call('get_embed_snippet', { sceneId: 's1' }, context)
		).rejects.toBe(unnamed)
		expect(client.createEmbedKey).not.toHaveBeenCalled()
	})

	it("adds only the domains not yet allowed to the scene's project, and answers with the list as stored", async () => {
		const { context, client } = fakeContext()

		const result = await call(
			'get_embed_snippet',
			{ sceneId: 's1', domains: ['a.test', 'b.test'] },
			context
		)
		await call(
			'get_embed_snippet',
			{ sceneId: 's1', domains: ['a.test'] },
			context
		)

		expect(client.setAllowedDomains.mock.calls).toEqual([
			['p-scene', { domains: ['a.test', 'b.test'] }]
		])
		expect(result).toMatchObject({
			embed: { allowedDomains: ['a.test', 'b.test'] }
		})
	})
})

describe('docs', () => {
	const llmsFull = [
		'# Vectreal Documentation',
		'',
		'> Every page.',
		'',
		'Source: https://vectreal.com/docs/getting-started',
		'',
		'# Getting started',
		'',
		'Upload a model, then publish it.',
		'',
		'---',
		'',
		'More text.',
		'',
		'',
		'Source: https://vectreal.com/docs/guides/publish-embed',
		'',
		'# Publish and embed',
		'',
		'Embed a published scene with an embed key and allowed domains.'
	].join('\n')

	it('splits /llms-full.txt at its Source lines only, not at rules inside a page', () => {
		const pages = parseDocPages(llmsFull)

		expect(pages.map(({ slug, title }) => [slug, title])).toEqual([
			['getting-started', 'Getting started'],
			['guides/publish-embed', 'Publish and embed']
		])
		expect(pages[0].markdown).toContain('More text.')
	})

	it('ranks a title match above a mention, and leaves out pages that match nothing', () => {
		const results = searchDocPages(parseDocPages(llmsFull), 'publish', 5)

		expect(results.map(({ slug }) => slug)).toEqual([
			'guides/publish-embed',
			'getting-started'
		])
		expect(searchDocPages(parseDocPages(llmsFull), 'hotspot', 5)).toEqual([])
	})

	it('read the docs from the origin, with no sign-in', async () => {
		const fetch = vi.fn(async (url: URL) =>
			url.pathname === '/llms-full.txt'
				? new Response(llmsFull)
				: new Response('# Page', {
						status: url.pathname.endsWith('.md') ? 200 : 404
					})
		)
		const { context } = fakeContext({
			fetch: fetch as unknown as typeof globalThis.fetch
		})

		await searchDocs.run(searchDocs.input.parse({ query: 'embed' }), context)
		expect(
			await readDoc.run({ slug: 'guides/publish-embed' }, context)
		).toEqual({ slug: 'guides/publish-embed', markdown: '# Page' })
		expect(fetch.mock.calls.map(([url]) => url.href)).toEqual([
			'https://vectreal.test/llms-full.txt',
			'https://vectreal.test/docs/guides/publish-embed.md'
		])
		expect(() => readDoc.input.parse({ slug: '../api/v1/me' })).toThrow()
	})
})
