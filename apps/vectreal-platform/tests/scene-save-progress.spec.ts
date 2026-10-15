/**
 * What a save reports while it runs, from the real orchestrator against a
 * stubbed API.
 *
 * The save panel draws only what these events say, so each claim it makes
 * (which files a save sends, which the server already held, how much has gone
 * up, when the settings are committed) is asserted here at its source.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ok, stubSceneApi } from './fixtures/scene-api-stub'
import { BillingLimitError } from '../app/lib/domain/billing/client/billing-limit-error'
import { executeSceneSaveOrchestrator } from '../app/lib/domain/scene/client/scene-save-orchestrator'
import {
	isSaveInFlight,
	reduceSaveProgress,
	summarizeSaveProgress
} from '../app/lib/domain/scene/client/scene-save-progress'

import type {
	SavePanelState,
	SaveProgressEvent
} from '../app/lib/domain/scene/client/scene-save-progress'
import type { SourceToSave } from '../app/lib/domain/scene/client/scene-source-to-save'

const png = (marker: number) =>
	new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, marker])

const sha256 = async (bytes: Uint8Array) =>
	Array.from(
		new Uint8Array(
			await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer)
		)
	)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')

interface Api {
	existingAssets?: Record<string, { assetId: string; contentHash: string }>
	/** Answers an upload of this file name with this response instead. */
	failUpload?: { name: string; response: Response }
	/** The connection drops while this file uploads. */
	dropUpload?: string
	unchanged?: boolean
	/** What downloading the stored original answers; unreadable when absent. */
	storedOriginal?: Uint8Array<ArrayBuffer>
}

const runSave = async (
	assets: Map<string, Uint8Array>,
	api: Api = {},
	thumbnail: string | null = null,
	source?: SourceToSave
) => {
	const events: SaveProgressEvent[] = []
	const uploadedNames: string[] = []
	let commit: FormData | null = null
	let nextId = 0

	stubSceneApi(async (form) => {
		const action = form.get('action')
		if (action === 'prepare-scene-upload') {
			return ok({
				sceneId: 's1',
				projectId: 'p1',
				existingAssets: api.existingAssets ?? {}
			})
		}
		if (action === 'upload-scene-asset' || action === 'upload-scene-gltf') {
			const file = form.get('file') as File
			if (api.failUpload?.name === file.name) return api.failUpload.response
			if (api.dropUpload === file.name) throw new TypeError('network')
			uploadedNames.push(file.name)
			nextId += 1
			return ok({ assetId: `id-${nextId}` })
		}
		commit = form
		return ok({ sceneId: 's1', unchanged: api.unchanged ?? false })
	})
	// The one request without a form: downloading a stored original.
	const sceneApi = globalThis.fetch
	vi.stubGlobal(
		'fetch',
		vi.fn((url: string, init?: RequestInit) =>
			init
				? sceneApi(url, init)
				: Promise.resolve(
						api.storedOriginal
							? new Response(api.storedOriginal)
							: new Response(null, { status: 404 })
					)
		)
	)

	const result = executeSceneSaveOrchestrator({
		userId: 'u1',
		currentSceneId: 's1',
		currentSettings: {} as never,
		sceneMetaState: { name: 'Chair' } as never,
		lastSavedSceneMeta: { name: 'Chair' } as never,
		lastSavedSettings: {} as never,
		optimizationSettings: {},
		optimizationReport: null,
		createRequestId: () => 'req-1',
		prepareGltfDocumentForUpload: async () => ({
			data: { asset: { version: '2.0' } },
			assets
		}),
		captureSceneThumbnail: async () => thumbnail,
		onProgress: (event) => events.push(event),
		source
	})

	return {
		result,
		events,
		uploadedNames,
		commitForm: () => commit as FormData | null
	}
}

const fold = (events: SaveProgressEvent[]) =>
	events.reduce<SavePanelState | null>(
		(state, event) =>
			reduceSaveProgress(
				state,
				event.type === 'file-added'
					? {
							type: 'file-added',
							file: {
								key: event.file.key,
								group: event.file.group,
								name: event.file.name,
								bytes: event.file.bytes
							},
							previewUrl: null
						}
					: event
			),
		null
	)

const added = (events: SaveProgressEvent[]) =>
	events.flatMap((event) => (event.type === 'file-added' ? [event.file] : []))

describe('what a save reports', () => {
	beforeEach(() => {
		vi.unstubAllGlobals()
	})

	it('lists every file of the model, and the scene document, before uploading any', async () => {
		const { result, events } = await runSave(
			new Map([
				['body/diffuse.png', png(1)],
				['scene.bin', new Uint8Array([1, 2, 3])]
			])
		)
		await result

		const files = added(events)
		expect(files.map((file) => [file.key, file.group])).toEqual([
			['body/diffuse.png', 'model'],
			['scene.bin', 'model'],
			['scene.gltf', 'model']
		])
		const firstUpload = events.findIndex(
			(event) => event.type === 'file-progress' || event.type === 'file-done'
		)
		const lastListed = events.findLastIndex(
			(event) => event.type === 'file-added'
		)
		expect(lastListed).toBeLessThan(firstUpload)
	})

	it('gives an image a preview and a buffer none', async () => {
		const { result, events } = await runSave(
			new Map([
				['body/diffuse.png', png(1)],
				['scene.bin', new Uint8Array([1, 2, 3])]
			])
		)
		await result

		const [image, buffer] = added(events)
		expect(image.preview).toBeInstanceOf(Blob)
		expect(buffer.preview).toBeNull()
	})

	it('reports a file the server already holds as reused, without uploading it', async () => {
		const bytes = png(1)
		const { result, events } = await runSave(new Map([['a.png', bytes]]), {
			existingAssets: {
				'a.png': { assetId: 'old-1', contentHash: await sha256(bytes) }
			}
		})
		await result

		expect(events).toContainEqual({
			type: 'file-done',
			key: 'a.png',
			reused: true
		})
		expect(events).not.toContainEqual(
			expect.objectContaining({ type: 'file-progress', key: 'a.png' })
		)
	})

	it('reports an unchanged scene document as reused', async () => {
		const document = new TextEncoder().encode(
			JSON.stringify({ asset: { version: '2.0' } })
		)
		const { result, events } = await runSave(new Map(), {
			existingAssets: {
				'scene.gltf': { assetId: 'doc-1', contentHash: await sha256(document) }
			}
		})
		await result

		expect(events).toContainEqual({
			type: 'file-done',
			key: 'scene.gltf',
			reused: true
		})
	})

	it('reports an uploaded file as it goes up, then as done', async () => {
		const { result, events } = await runSave(new Map([['a.png', png(1)]]))
		await result

		const forFile = events.filter(
			(event) => 'key' in event && event.key === 'a.png'
		)
		expect(forFile).toEqual([
			{ type: 'file-progress', key: 'a.png', fraction: 0.5 },
			{ type: 'file-progress', key: 'a.png', fraction: 1 },
			{ type: 'file-done', key: 'a.png', reused: false }
		])
	})

	it('accounts for every byte by the time it is saved', async () => {
		const bytes = png(2)
		const { result, events } = await runSave(
			new Map([
				['a.png', png(1)],
				['b.png', bytes]
			]),
			{
				existingAssets: {
					'b.png': { assetId: 'old-2', contentHash: await sha256(bytes) }
				}
			}
		)
		await result

		const state = fold(events)
		expect(state?.status).toBe('saved')
		const summary = summarizeSaveProgress(state as SavePanelState)
		expect(summary.sent).toBe(summary.bytes)
		expect(summary.bytes).toBeGreaterThan(0)
	})

	it('commits the settings only after every file is stored, and says so', async () => {
		const { result, events } = await runSave(new Map([['a.png', png(1)]]))
		await result

		const types = events.map((event) => event.type)
		expect(types[0]).toBe('preparing')
		expect(types.at(-2)).toBe('committing')
		expect(types.at(-1)).toBe('saved')
		expect(types.lastIndexOf('file-done')).toBeLessThan(
			types.indexOf('committing')
		)
	})

	it('passes on that nothing changed', async () => {
		const { result, events } = await runSave(new Map(), { unchanged: true })
		await result

		expect(events.at(-1)).toEqual({ type: 'saved', unchanged: true })
	})

	it('puts the thumbnail in the preview group', async () => {
		const { result, events } = await runSave(
			new Map(),
			{},
			'data:image/png;base64,iVBORw0KGgo='
		)
		await result

		expect(added(events)).toContainEqual(
			expect.objectContaining({ group: 'preview', name: 'Thumbnail' })
		)
	})

	it('marks the file that failed and fails the save', async () => {
		const { result, events } = await runSave(new Map([['a.png', png(1)]]), {
			failUpload: {
				name: 'a.png',
				response: Response.json(
					{ success: false, error: 'disk full' },
					{
						status: 500
					}
				)
			}
		})

		await expect(result).rejects.toThrow('disk full')
		expect(events).toContainEqual({ type: 'file-failed', key: 'a.png' })
		expect(events.map((event) => event.type)).not.toContain('committing')
	})

	it('fails the save when the connection drops mid-upload', async () => {
		const { result, events } = await runSave(new Map([['a.png', png(1)]]), {
			dropUpload: 'a.png'
		})

		await expect(result).rejects.toThrow('The upload was interrupted.')
		expect(events).toContainEqual({ type: 'file-failed', key: 'a.png' })
	})

	// Uploads moved off `fetch` to report progress; the billing limit an upload
	// can hit must still reach the caller as one, or the upgrade dialog never opens.
	it('still reports a billing limit on an upload as one', async () => {
		const { result } = await runSave(new Map([['a.png', png(1)]]), {
			failUpload: {
				name: 'a.png',
				response: Response.json(
					{ success: false, error: 'Storage limit reached' },
					{ status: 403 }
				)
			}
		})

		await expect(result).rejects.toBeInstanceOf(BillingLimitError)
	})

	describe('the original', () => {
		const original = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0])

		it('uploads it apart from the model and commits it as the original', async () => {
			const { result, events, uploadedNames, commitForm } = await runSave(
				new Map([['a.png', png(1)]]),
				{},
				null,
				{ kind: 'upload', bytes: original }
			)
			await result

			expect(uploadedNames).toContain('source.glb')
			expect(added(events)).toContainEqual(
				expect.objectContaining({ key: 'source.glb', group: 'original' })
			)
			const form = commitForm() as FormData
			const modelIds = JSON.parse(form.get('sceneAssetIds') as string)
			expect(form.get('sourceAssetId')).toEqual(expect.any(String))
			expect(modelIds).not.toContain(form.get('sourceAssetId'))
		})

		it('sends nothing for an original the server already holds', async () => {
			const { result, events, uploadedNames, commitForm } = await runSave(
				new Map(),
				{
					existingAssets: {
						'source.glb': {
							assetId: 'original-1',
							contentHash: await sha256(original)
						}
					}
				},
				null,
				{ kind: 'upload', bytes: original }
			)
			await result

			expect(uploadedNames).not.toContain('source.glb')
			expect(events).toContainEqual({
				type: 'file-done',
				key: 'source.glb',
				reused: true
			})
			expect(commitForm()?.get('sourceAssetId')).toBe('original-1')
		})

		const storedOriginal: SourceToSave = {
			kind: 'linked',
			source: {
				assetId: 'original-2',
				url: '/api/scenes/s0/assets/original-2',
				fileName: 'source.glb',
				mimeType: 'model/gltf-binary',
				byteSize: 38
			}
		}

		it('re-links a stored original the scene still links, without sending it', async () => {
			const { result, uploadedNames, commitForm } = await runSave(
				new Map(),
				{
					existingAssets: {
						'source.glb': { assetId: 'original-2', contentHash: 'h' }
					},
					storedOriginal: original
				},
				null,
				storedOriginal
			)

			expect((await result).keptOriginal).toEqual({
				assetId: 'original-2',
				url: '/api/scenes/s1/assets/original-2'
			})
			expect(uploadedNames).not.toContain('source.glb')
			expect(commitForm()?.get('sourceAssetId')).toBe('original-2')
		})

		it('sends a stored original again when the scene no longer links it', async () => {
			const { result, uploadedNames, commitForm } = await runSave(
				new Map(),
				{ storedOriginal: original },
				null,
				storedOriginal
			)

			const { keptOriginal } = await result
			expect(uploadedNames).toContain('source.glb')
			expect(commitForm()?.get('sourceAssetId')).toBe(keptOriginal?.assetId)
			expect(keptOriginal?.assetId).not.toBe('original-2')
		})

		it('stops the save when a stored original the scene no longer links cannot be read', async () => {
			const { result, commitForm } = await runSave(
				new Map(),
				{},
				null,
				storedOriginal
			)

			await expect(result).rejects.toThrow('kept original could not be read')
			// Committing without it would unlink the original for good.
			expect(commitForm()).toBeNull()
		})

		it('names the original when it alone hits the storage limit', async () => {
			const { result } = await runSave(
				new Map(),
				{
					failUpload: {
						name: 'source.glb',
						response: Response.json(
							{ success: false, error: 'Storage limit reached' },
							{ status: 403 }
						)
					}
				},
				null,
				{ kind: 'upload', bytes: original }
			)

			const error = await result.catch((caught: unknown) => caught)
			expect(error).toBeInstanceOf(BillingLimitError)
			expect((error as Error).message).toMatch(/turn off "Keep the original"/)
		})

		it('commits no original when the save keeps none', async () => {
			const { result, events, commitForm } = await runSave(new Map(), {})
			await result

			expect(commitForm()?.has('sourceAssetId')).toBe(false)
			expect(added(events).map((file) => file.group)).not.toContain('original')
		})
	})
})

describe('isSaveInFlight', () => {
	const at = (status: SavePanelState['status']): SavePanelState => ({
		status,
		files: [],
		message: null
	})

	it('is true from the first event until the save settles', () => {
		for (const status of ['preparing', 'uploading', 'committing'] as const) {
			expect(isSaveInFlight(at(status)), status).toBe(true)
		}
	})

	it('is false once a save has settled, or before any', () => {
		for (const status of ['saved', 'unchanged', 'failed'] as const) {
			expect(isSaveInFlight(at(status)), status).toBe(false)
		}
		expect(isSaveInFlight(null)).toBe(false)
	})
})
