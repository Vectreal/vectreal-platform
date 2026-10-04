import {
	loadModelFromSceneData,
	loadModelFromServer
} from '@vctrl/hooks/use-load-model/scene-loaders'

import { embedManifestToScenePayload } from '../app/lib/domain/scene/client/embed-manifest-payload'

import type { LoadedModel, ModelSource } from '@vctrl/hooks/use-load-model'
import type { LoadContext } from '@vctrl/hooks/use-load-model/load-context'

const SCENE_ID = 'scene-1'
const MANIFEST_URL = `/api/scenes/${SCENE_ID}?projectId=proj-1&preview=1&token=tok`
const MODEL_URL = '/api/scenes/scene-1/assets/published-glb-id?preview=1'
const BAKE_URL = '/api/scenes/scene-1/assets/bake-id?preview=1'

const GLB_BYTES = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 1, 2, 3, 4])
const BAKE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

function embedManifest(overrides: Record<string, unknown> = {}) {
	return {
		success: true,
		data: {
			sceneId: SCENE_ID,
			meta: { name: 'Blue Vans Shoe', description: 'A shoe' },
			publishedModel: {
				url: MODEL_URL,
				fileName: 'blue-vans-shoe.glb',
				mimeType: 'model/gltf-binary',
				byteSize: GLB_BYTES.byteLength
			},
			assetRefs: {
				'bake-id': {
					url: BAKE_URL,
					fileName: 'shadow-bake.png',
					mimeType: 'image/png',
					byteSize: BAKE_BYTES.byteLength
				}
			},
			settings: {
				camera: { cameras: [{ cameraId: 'cam-1', name: 'Front' }] },
				controls: { autoRotate: true },
				shadows: { baked: { assetId: 'bake-id', signature: 'sig' } }
			},
			settingsUpdatedAt: '2026-08-21T00:00:00.000Z',
			...overrides
		}
	}
}

/** Records every request so a stray POST to the legacy endpoint is visible. */
function stubFetch(manifestBody: unknown, manifestStatus = 200) {
	const calls: { url: string; method: string; headers: Headers }[] = []

	const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
		calls.push({
			url,
			method: init?.method ?? 'GET',
			headers: new Headers(init?.headers)
		})

		if (url === MODEL_URL) {
			return {
				ok: true,
				status: 200,
				arrayBuffer: async () => GLB_BYTES.buffer
			}
		}
		if (url === BAKE_URL) {
			return {
				ok: true,
				status: 200,
				arrayBuffer: async () => BAKE_BYTES.buffer
			}
		}

		return {
			ok: manifestStatus >= 200 && manifestStatus < 300,
			status: manifestStatus,
			statusText: manifestStatus === 404 ? 'Not Found' : 'OK',
			json: async () => manifestBody
		}
	})

	vi.stubGlobal('fetch', fetchMock)
	return calls
}

function buildContext() {
	const published: LoadedModel[] = []
	const parseGLBToThreeJS = vi.fn(async (_bytes: Uint8Array) => ({
		scene: { name: 'three-scene' },
		animations: []
	}))
	const loadToThreeJS = vi.fn()
	const prepareDracoDecoder = vi.fn(async () => {})

	const ctx = {
		modelLoader: { parseGLBToThreeJS, loadToThreeJS, prepareDracoDecoder },
		optimizer: undefined,
		publish: (loaded: LoadedModel) => published.push(loaded),
		mayIngest: () => true,
		onProgress: () => {}
	} as unknown as LoadContext

	return {
		ctx,
		parseGLBToThreeJS,
		loadToThreeJS,
		prepareDracoDecoder,
		published
	}
}

const source: Extract<ModelSource, { kind: 'server' }> = {
	kind: 'server',
	sceneId: SCENE_ID,
	serverOptions: { endpoint: MANIFEST_URL, apiKey: 'tok' },
	parseMode: 'direct'
}

describe('published-GLB embed load', () => {
	afterEach(() => vi.unstubAllGlobals())

	/**
	 * The guard for the legacy-POST bypass. `fetchManifestPayload` falls back to
	 * `POST get-scene-settings` whenever a manifest fails its shape check, and
	 * that action returns the whole editor payload. An embed manifest has no
	 * `gltfJson`, so without an explicit `publishedModel` arm in the predicate
	 * every embed would silently re-acquire exactly what the manifest withholds.
	 */
	it('accepts a manifest with no gltfJson and never falls back to the POST', async () => {
		const calls = stubFetch(embedManifest())
		const { ctx } = buildContext()

		await loadModelFromServer(source, ctx)

		expect(calls.some((call) => call.method === 'POST')).toBe(false)
	})

	it('requests the published GLB alone, leaving the bake to the viewer', async () => {
		const calls = stubFetch(embedManifest())
		const { ctx } = buildContext()

		await loadModelFromServer(source, ctx)

		const assetCalls = calls
			.filter((call) => call.url !== MANIFEST_URL)
			.map((call) => call.url)

		expect(assetCalls).toEqual([MODEL_URL])
	})

	it('parses the GLB bytes once, without the editor document round trip', async () => {
		stubFetch(embedManifest())
		const { ctx, parseGLBToThreeJS, loadToThreeJS } = buildContext()

		await loadModelFromServer(source, ctx)

		expect(parseGLBToThreeJS).toHaveBeenCalledTimes(1)
		expect(Array.from(parseGLBToThreeJS.mock.calls[0][0])).toEqual(
			Array.from(GLB_BYTES)
		)
		expect(loadToThreeJS).not.toHaveBeenCalled()
	})

	it('leaves the Draco decoder alone for a GLB recorded as not needing it', async () => {
		stubFetch(
			embedManifest({
				publishedModel: {
					url: MODEL_URL,
					fileName: 'blue-vans-shoe.glb',
					mimeType: 'model/gltf-binary',
					byteSize: GLB_BYTES.byteLength,
					usesDraco: false
				}
			})
		)
		const { ctx, prepareDracoDecoder } = buildContext()

		await loadModelFromServer(source, ctx)

		expect(prepareDracoDecoder).not.toHaveBeenCalled()
	})

	it('warms the Draco decoder before the model has downloaded', async () => {
		const order: string[] = []
		stubFetch(embedManifest())
		const { ctx, prepareDracoDecoder } = buildContext()
		prepareDracoDecoder.mockImplementation(async () => {
			order.push('decoder')
		})
		const fetchMock = vi.mocked(fetch)
		const originalFetch = fetchMock.getMockImplementation()!
		fetchMock.mockImplementation(async (url, init) => {
			if (url === MODEL_URL) order.push('model')
			return originalFetch(url, init)
		})

		await loadModelFromServer(source, ctx)

		expect(order.indexOf('decoder')).toBeGreaterThan(-1)
		expect(order.indexOf('decoder')).toBeLessThan(order.indexOf('model'))
	})

	it('keeps settings and meta while reporting no glTF document', async () => {
		stubFetch(embedManifest())
		const { ctx, published } = buildContext()

		const loaded = await loadModelFromServer(source, ctx)

		expect(loaded.sceneData?.gltfJson).toBeNull()
		expect(loaded.sceneData?.camera?.cameras?.[0]?.cameraId).toBe('cam-1')
		expect(loaded.sceneData?.controls?.autoRotate).toBe(true)
		expect(loaded.sceneData?.meta?.name).toBe('Blue Vans Shoe')
		expect(published).toHaveLength(1)
	})

	it('hands the viewer the bake by reference, and no model bytes', async () => {
		stubFetch(embedManifest())
		const { ctx } = buildContext()

		const loaded = await loadModelFromServer(source, ctx)

		expect(
			Object.values(loaded.sceneData?.assetRefs ?? {}).map((ref) => ref.url)
		).toEqual([BAKE_URL])
		// The GLB rides in the asset map only while it is fetched; it must not
		// leak into the data the viewer sees.
		expect(loaded.sceneData?.assetData).toEqual({})
	})

	it('loads a scene that has no shadow bake', async () => {
		const calls = stubFetch(
			embedManifest({ assetRefs: {}, settings: { controls: {} } })
		)
		const { ctx } = buildContext()

		const loaded = await loadModelFromServer(source, ctx)

		expect(loaded.sceneData?.assetData).toEqual({})
		expect(calls.some((call) => call.url === BAKE_URL)).toBe(false)
	})

	/**
	 * An auth failure is deterministic. Retrying it over the legacy POST only
	 * fails a second time, doubles the requests, and flattens a precise status
	 * into a generic "server load failed".
	 */
	it('throws a structured not_found on a 404 manifest without retrying', async () => {
		const calls = stubFetch({ success: false, error: 'Scene not found' }, 404)
		const { ctx } = buildContext()

		await expect(loadModelFromServer(source, ctx)).rejects.toMatchObject({
			code: 'not_found',
			recoverable: false
		})

		expect(calls.some((call) => call.method === 'POST')).toBe(false)
	})

	/*
	  The document's preload of the GLB is reused only by a request that adds
	  no header of its own; one carrying the key as `Authorization` downloads
	  the model a second time.
	*/
	it('loads an inline manifest with no request beyond the model, and no key header', async () => {
		const calls = stubFetch(null)
		const { ctx, published } = buildContext()
		const manifest = embedManifest().data

		await loadModelFromSceneData(
			{
				kind: 'scene-data',
				sceneId: SCENE_ID,
				sceneData: embedManifestToScenePayload(manifest as never),
				parseMode: 'direct'
			},
			ctx
		)

		expect(calls.map((call) => call.url)).toEqual([MODEL_URL])
		expect(calls[0].headers.has('authorization')).toBe(false)
		expect(published[0].sceneData?.meta?.name).toBe('Blue Vans Shoe')
	})
})
