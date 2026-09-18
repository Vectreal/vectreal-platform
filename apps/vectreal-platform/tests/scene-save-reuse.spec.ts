/**
 * Which stored asset a save is allowed to reuse.
 *
 * THE RULE THIS GUARDS WAS UNGATED. `scene-save-orchestrator.ts` carries a
 * long comment forswearing a basename nomination - reusing a stored row whose
 * name differs from the asset being saved - because the server never renames a
 * reused row, so it leaves a scene half-flat and half-foldered, and in that
 * state the loader's name-only rung hands every foldered URI to the wrong file,
 * permanently. Re-adding that nomination reddened nothing in any suite: the one
 * spec naming the orchestrator mocks it away entirely.
 *
 * It is client code over global `fetch`, so the gap was a choice rather than a
 * constraint. This drives the real `executeSceneSaveOrchestrator` against a
 * stubbed API and asserts which assets it uploads and which it reuses.
 *
 * Mutation gates, all executed:
 *  - nominate by basename at the `existingAssets` lookup and `does not reuse a
 *    stored asset under a name it does not have` goes red;
 *  - return `existing.contentHash` where `existing.assetId` belongs and
 *    `records the reused asset's id, not something else about it` goes red.
 *    Asserting on uploaded names alone could not see that: nothing is uploaded
 *    either way.
 *
 * The stub answers in the envelope the real endpoints use, `{ success, data }`
 * (`ApiResponse.success`). A bare payload also works, because `toJsonOrThrow`
 * ends `payload.data || payload` - which means a stub without the envelope
 * leaves that line unguarded while every real save breaks on it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { executeSceneSaveOrchestrator } from '../app/lib/domain/scene/client/scene-save-orchestrator'

const png = (marker: number) =>
	new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, marker])

/** The hash the orchestrator computes, so a fixture can claim a row matches. */
const sha256 = async (bytes: Uint8Array) =>
	Array.from(
		new Uint8Array(
			await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer)
		)
	)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')

interface Saved {
	/** Names sent to `upload-scene-asset`, in order. */
	uploaded: string[]
	/** The bytes that went with them, so a right name with wrong bytes shows. */
	uploadedBytes: number[][]
	/** What the commit was told to link. */
	sceneAssetIds: string[]
}

/** The envelope every real endpoint answers in. */
const ok = (data: unknown) => Response.json({ success: true, data })

const runSave = async (
	existingAssets: Record<string, { assetId: string; contentHash: string }>,
	assets: Map<string, Uint8Array>
): Promise<Saved> => {
	const uploaded: string[] = []
	const uploadedBytes: number[][] = []
	let sceneAssetIds: string[] = []
	let nextId = 0

	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url: string, init: { body: FormData }) => {
			const form = init.body
			const action = form.get('action')

			if (action === 'prepare-scene-upload') {
				return ok({ sceneId: 's1', projectId: 'p1', existingAssets })
			}

			if (action === 'upload-scene-asset') {
				const file = form.get('file') as File
				uploaded.push(file.name)
				uploadedBytes.push([...new Uint8Array(await file.arrayBuffer())])
				nextId += 1
				return ok({ assetId: `new-${nextId}` })
			}

			if (action === 'upload-scene-gltf') {
				nextId += 1
				return ok({ assetId: `gltf-${nextId}` })
			}

			sceneAssetIds = JSON.parse(String(form.get('sceneAssetIds') ?? '[]'))
			return ok({ sceneId: 's1' })
		})
	)

	await executeSceneSaveOrchestrator({
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
		captureSceneThumbnail: async () => null
	})

	return { uploaded, uploadedBytes, sceneAssetIds }
}

describe('which stored asset a save reuses', () => {
	beforeEach(() => {
		vi.unstubAllGlobals()
	})

	it('does not reuse a stored asset under a name it does not have', async () => {
		/*
		  The legacy shape: every scene saved before assets carried their folders
		  has flat stored names. `body/diffuse.png` must NOT be matched to the
		  stored `diffuse.png`, however well the bytes agree - the server keeps
		  the reused row's old name, and one flat name among foldered siblings is
		  what makes the loader answer every foldered URI with the wrong file.
		*/
		const bytes = png(1)

		const saved = await runSave(
			{ 'diffuse.png': { assetId: 'old-1', contentHash: await sha256(bytes) } },
			new Map([['body/diffuse.png', bytes]])
		)

		expect(saved.uploaded).toEqual(['body/diffuse.png'])
		expect(saved.sceneAssetIds).not.toContain('old-1')
	})

	it('reuses a stored asset whose name matches exactly and whose bytes agree', async () => {
		const bytes = png(2)

		const saved = await runSave(
			{
				'body/diffuse.png': {
					assetId: 'old-2',
					contentHash: await sha256(bytes)
				}
			},
			new Map([['body/diffuse.png', bytes]])
		)

		expect(saved.uploaded).toEqual([])
		expect(saved.sceneAssetIds).toContain('old-2')
	})

	it('records the reused asset id, not something else about it', async () => {
		/*
		  Uploading nothing is only half of reuse; the other half is telling the
		  commit which row to link. Asserting on uploaded names alone cannot see
		  a reuse that hands back the content hash, or the name, in place of the
		  id - nothing is uploaded either way, and the save fails later at
		  `assertAssetsBelongToProject` with "One or more uploaded assets are
		  missing", which names neither the asset nor the cause.
		*/
		const bytes = png(5)
		const contentHash = await sha256(bytes)

		const saved = await runSave(
			{ 'body/diffuse.png': { assetId: 'old-5', contentHash } },
			new Map([['body/diffuse.png', bytes]])
		)

		expect(saved.sceneAssetIds).toEqual(['old-5', expect.any(String)])
		expect(saved.sceneAssetIds).not.toContain(contentHash)
	})

	it('re-uploads a stored asset whose name matches but whose bytes changed', async () => {
		const saved = await runSave(
			{
				'body/diffuse.png': {
					assetId: 'old-3',
					contentHash: await sha256(png(3))
				}
			},
			new Map([['body/diffuse.png', png(4)]])
		)

		expect(saved.uploaded).toEqual(['body/diffuse.png'])
		/* The bytes that went up are the new ones, not the ones it matched. */
		expect(saved.uploadedBytes[0]).toEqual([...png(4)])
	})
})
